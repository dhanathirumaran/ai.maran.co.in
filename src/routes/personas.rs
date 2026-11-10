use crate::models::CreatePersonaPayload;
use crate::routes::chat::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

pub async fn list_personas(State(state): State<AppState>) -> impl IntoResponse {
    match state.db.list_personas().await {
        Ok(personas) => (StatusCode::OK, Json(personas)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

pub async fn create_persona(
    State(state): State<AppState>,
    Json(payload): Json<CreatePersonaPayload>,
) -> impl IntoResponse {
    let id = Uuid::new_v4().to_string();
    match state
        .db
        .create_persona(
            &id,
            &payload.title,
            payload.description.as_deref(),
            &payload.system_prompt,
        )
        .await
    {
        Ok(persona) => (StatusCode::CREATED, Json(persona)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

pub async fn delete_persona(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.db.delete_persona(&id).await {
        Ok(true) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Ok(false) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Cannot delete built-in persona or persona not found" })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}
