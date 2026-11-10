use crate::config::AppConfig;
use crate::db::Database;
use crate::llm::{LlmClient, StreamItem};
use crate::models::ChatStreamPayload;
use axum::{
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures_util::Stream;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
    pub llm: Arc<LlmClient>,
}

pub async fn chat_stream(
    State(state): State<AppState>,
    Json(payload): Json<ChatStreamPayload>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let (tx, rx) = mpsc::channel::<Result<Event, Infallible>>(128);

    tokio::spawn(async move {
        // 1. Resolve or create conversation
        let conversation_id = match payload.conversation_id.clone() {
            Some(id) if !id.trim().is_empty() => id,
            _ => {
                let new_id = Uuid::new_v4().to_string();
                let initial_title = if payload.message.len() > 30 {
                    format!("{}...", &payload.message[..30])
                } else if !payload.message.is_empty() {
                    payload.message.clone()
                } else {
                    "New Chat".to_string()
                };

                let default_model = payload
                    .model
                    .clone()
                    .unwrap_or_else(|| state.config.default_model.clone());

                let _ = state
                    .db
                    .create_conversation(
                        &new_id,
                        &initial_title,
                        &default_model,
                        payload.system_prompt.as_deref(),
                    )
                    .await;

                new_id
            }
        };

        // Notify client of the active conversation_id via SSE event
        let _ = tx
            .send(Ok(Event::default()
                .event("conversation_id")
                .data(&conversation_id)))
            .await;

        // 2. Save user message to database
        let user_msg_id = Uuid::new_v4().to_string();
        let atts_json = payload
            .attachments
            .as_ref()
            .and_then(|a| serde_json::to_string(a).ok());

        let _ = state
            .db
            .add_message(
                &user_msg_id,
                &conversation_id,
                "user",
                &payload.message,
                atts_json.as_deref(),
            )
            .await;

        // 3. Retrieve past messages for context
        let past_messages = state
            .db
            .get_messages(&conversation_id)
            .await
            .unwrap_or_default();

        let history: Vec<(String, String)> = past_messages
            .into_iter()
            .filter(|m| m.id != user_msg_id)
            .map(|m| (m.role, m.content))
            .collect();

        // 4. Resolve API configuration
        let base_url = payload
            .base_url
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| state.config.default_base_url.clone());

        let api_key = payload
            .api_key
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| state.config.default_api_key.clone());

        let model = payload
            .model
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| state.config.default_model.clone());

        // 5. Connect to upstream LLM via channel
        let (upstream_tx, mut upstream_rx) = mpsc::channel::<StreamItem>(128);

        let llm = state.llm.clone();
        let system_prompt = payload.system_prompt.clone();
        let new_message = payload.message.clone();
        let attachments = payload.attachments.clone();
        let temperature = payload.temperature;
        let max_tokens = payload.max_tokens;

        tokio::spawn(async move {
            llm.stream_chat(
                &base_url,
                &api_key,
                &model,
                system_prompt.as_deref(),
                history,
                &new_message,
                attachments,
                temperature,
                max_tokens,
                upstream_tx,
            )
            .await;
        });

        // 6. Forward tokens to client while accumulating the full assistant response
        let mut full_assistant_content = String::new();

        while let Some(item) = upstream_rx.recv().await {
            match item {
                StreamItem::Chunk(text) => {
                    full_assistant_content.push_str(&text);
                    let _ = tx.send(Ok(Event::default().data(text))).await;
                }
                StreamItem::Done => {
                    let _ = tx.send(Ok(Event::default().event("done").data(""))).await;
                    break;
                }
                StreamItem::Error(err) => {
                    let _ = tx
                        .send(Ok(Event::default().event("error").data(err)))
                        .await;
                    break;
                }
            }
        }

        // 7. Persist completed assistant message into SQLite
        if !full_assistant_content.is_empty() {
            let assistant_msg_id = Uuid::new_v4().to_string();
            let _ = state
                .db
                .add_message(
                    &assistant_msg_id,
                    &conversation_id,
                    "assistant",
                    &full_assistant_content,
                    None,
                )
                .await;
        }
    });

    let stream = ReceiverStream::new(rx);
    Sse::new(stream).keep_alive(KeepAlive::default())
}
