pub mod chat;
pub mod conversations;
pub mod personas;
pub mod static_files;

use axum::{
    routing::{delete, get, post},
    Json, Router,
};
use chat::{chat_stream, AppState};
use conversations::{
    create_conversation, delete_conversation, get_conversation, list_conversations,
    update_conversation,
};
use personas::{create_persona, delete_persona, list_personas};
use serde_json::json;

pub fn create_router(app_state: AppState) -> Router {
    let api_routes = Router::new()
        .route(
            "/health",
            get(|| async {
                Json(json!({
                    "status": "ok",
                    "app": "ai-server",
                    "version": "0.1.0"
                }))
            }),
        )
        .route("/chat/stream", post(chat_stream))
        .route(
            "/conversations",
            get(list_conversations).post(create_conversation),
        )
        .route(
            "/conversations/:id",
            get(get_conversation)
                .patch(update_conversation)
                .delete(delete_conversation),
        )
        .route("/personas", get(list_personas).post(create_persona))
        .route("/personas/:id", delete(delete_persona))
        .with_state(app_state);

    Router::new()
        .nest("/api", api_routes)
        .merge(static_files::create_static_router())
}
