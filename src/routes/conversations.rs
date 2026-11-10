use crate::models::{
    ConversationDetail, CreateConversationPayload, UpdateConversationPayload,
};
use crate::routes::chat::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

pub async fn list_conversations(State(state): State<AppState>) -> impl IntoResponse {
    match state.db.list_conversations().await {
        Ok(convs) => (StatusCode::OK, Json(convs)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

pub async fn get_conversation(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.db.get_conversation(&id).await {
        Ok(Some(conv)) => {
            let messages = state.db.get_messages(&id).await.unwrap_or_default();
            (
                StatusCode::OK,
                Json(ConversationDetail {
                    conversation: conv,
                    messages,
                }),
            )
                .into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Conversation not found" })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

pub async fn create_conversation(
    State(state): State<AppState>,
    Json(payload): Json<CreateConversationPayload>,
) -> impl IntoResponse {
    let id = Uuid::new_v4().to_string();
    let title = payload.title.unwrap_or_else(|| "New Chat".to_string());
    let model = payload
        .model
        .unwrap_or_else(|| state.config.default_model.clone());
    let system_prompt = payload.system_prompt.as_deref();

    match state
        .db
        .create_conversation(&id, &title, &model, system_prompt)
        .await
    {
        Ok(conv) => (StatusCode::CREATED, Json(conv)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

pub async fn update_conversation(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateConversationPayload>,
) -> impl IntoResponse {
    match state
        .db
        .update_conversation(
            &id,
            payload.title.as_deref(),
            payload.model.as_deref(),
            payload.system_prompt.as_deref(),
        )
        .await
    {
        Ok(true) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Conversation not found or nothing updated" })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

pub async fn delete_conversation(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.db.delete_conversation(&id).await {
        Ok(true) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Conversation not found" })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}
