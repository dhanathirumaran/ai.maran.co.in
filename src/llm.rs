use crate::models::{
    Attachment, OpenAIChatChunk, OpenAIChatRequest, OpenAIContent, OpenAIContentPart,
    OpenAIImageUrl, OpenAIMessage,
};
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use tokio::sync::mpsc;
use tracing::{error, info};

#[derive(Debug)]
pub enum StreamItem {
    Chunk(String),
    Reasoning(String),
    Done,
    Error(String),
}

pub struct LlmClient {
    client: reqwest::Client,
}

impl LlmClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder().build().unwrap(),
        }
    }

    pub async fn stream_chat(
        &self,
        base_url: &str,
        api_key: &str,
        model: &str,
        system_prompt: Option<&str>,
        history: Vec<(String, String)>,
        new_message: &str,
        attachments: Option<Vec<Attachment>>,
        temperature: Option<f32>,
        max_tokens: Option<u32>,
        tx: mpsc::Sender<StreamItem>,
    ) {
        let mut messages = Vec::new();

        // 1. Add system prompt if available
        if let Some(sp) = system_prompt {
            if !sp.trim().is_empty() {
                messages.push(OpenAIMessage {
                    role: "system".to_string(),
                    content: OpenAIContent::Text(sp.to_string()),
                });
            }
        }

        // 2. Add past conversation history
        for (role, content) in history {
            messages.push(OpenAIMessage {
                role,
                content: OpenAIContent::Text(content),
            });
        }

        // 3. Format current user message with optional attachments
        let user_content = if let Some(atts) = attachments {
            if atts.is_empty() {
                OpenAIContent::Text(new_message.to_string())
            } else {
                let mut parts = Vec::new();
                if !new_message.is_empty() {
                    parts.push(OpenAIContentPart::Text {
                        text: new_message.to_string(),
                    });
                }
                for att in atts {
                    if att.mime_type.starts_with("image/") {
                        let data_url =
                            format!("data:{};base64,{}", att.mime_type, att.data_base64);
                        parts.push(OpenAIContentPart::ImageUrl {
                            image_url: OpenAIImageUrl { url: data_url },
                        });
                    } else {
                        // Non-image text/code file: include as labeled context
                        parts.push(OpenAIContentPart::Text {
                            text: format!(
                                "\n--- Attached File: {} ---\n{}\n",
                                att.name, att.data_base64
                            ),
                        });
                    }
                }
                OpenAIContent::Parts(parts)
            }
        } else {
            OpenAIContent::Text(new_message.to_string())
        };

        messages.push(OpenAIMessage {
            role: "user".to_string(),
            content: user_content,
        });

        let payload = OpenAIChatRequest {
            model: model.to_string(),
            messages,
            temperature,
            max_tokens,
            stream: true,
        };

        // Normalize base URL
        let mut endpoint = base_url.trim().trim_end_matches('/').to_string();
        if !endpoint.ends_with("/chat/completions") {
            if endpoint.ends_with("/v1") || endpoint.ends_with("/openai") {
                endpoint.push_str("/chat/completions");
            } else {
                endpoint.push_str("/v1/chat/completions");
            }
        }

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if !api_key.trim().is_empty() {
            if let Ok(auth_val) = HeaderValue::from_str(&format!("Bearer {}", api_key.trim())) {
                headers.insert(AUTHORIZATION, auth_val);
            }
        }

        info!("Connecting upstream to: {} (model: {})", endpoint, model);

        let response = match self
            .client
            .post(&endpoint)
            .headers(headers)
            .json(&payload)
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                error!("Upstream connection error: {}", e);
                let _ = tx
                    .send(StreamItem::Error(format!(
                        "Failed to connect to LLM provider ({}): {}",
                        endpoint, e
                    )))
                    .await;
                return;
            }
        };

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            error!("Upstream returned error {}: {}", status, error_text);
            let _ = tx
                .send(StreamItem::Error(format!(
                    "Upstream API Error (HTTP {}): {}",
                    status, error_text
                )))
                .await;
            return;
        }

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();

        while let Some(item) = stream.next().await {
            match item {
                Ok(bytes) => {
                    if let Ok(text) = std::str::from_utf8(&bytes) {
                        buffer.push_str(text);

                        while let Some(pos) = buffer.find('\n') {
                            let line = buffer[..pos].trim().to_string();
                            buffer = buffer[pos + 1..].to_string();

                            if line.is_empty() {
                                continue;
                            }

                            if line == "data: [DONE]" {
                                let _ = tx.send(StreamItem::Done).await;
                                return;
                            }

                            if let Some(json_str) = line.strip_prefix("data: ") {
                                if let Ok(chunk) =
                                    serde_json::from_str::<OpenAIChatChunk>(json_str)
                                {
                                    if let Some(choices) = chunk.choices {
                                        for choice in choices {
                                            if let Some(delta) = choice.delta {
                                                if let Some(reasoning) = delta.reasoning_content {
                                                    let _ = tx
                                                        .send(StreamItem::Reasoning(reasoning))
                                                        .await;
                                                }
                                                if let Some(content) = delta.content {
                                                    let _ = tx
                                                        .send(StreamItem::Chunk(content))
                                                        .await;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Error reading streaming response: {}", e);
                    let _ = tx.send(StreamItem::Error(e.to_string())).await;
                    break;
                }
            }
        }

        let _ = tx.send(StreamItem::Done).await;
    }
}
