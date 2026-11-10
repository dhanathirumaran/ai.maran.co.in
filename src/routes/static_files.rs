use axum::{
    http::{header, HeaderValue, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use tower_http::services::ServeDir;

#[cfg(feature = "embed-frontend")]
use rust_embed::RustEmbed;

#[cfg(feature = "embed-frontend")]
#[derive(RustEmbed)]
#[folder = "frontend/"]
struct EmbeddedAssets;

#[cfg(feature = "embed-frontend")]
async fn static_handler(axum::extract::Path(path): axum::extract::Path<String>) -> impl IntoResponse {
    let path = path.trim_start_matches('/');
    let target = if path.is_empty() { "index.html" } else { path };

    match EmbeddedAssets::get(target) {
        Some(content) => {
            let mime = mime_guess::from_path(target).first_or_octet_stream();
            ([(header::CONTENT_TYPE, HeaderValue::from_str(mime.as_ref()).unwrap())], content.data).into_response()
        }
        None => {
            // Fallback to index.html for SPA routing
            match EmbeddedAssets::get("index.html") {
                Some(index) => Html(index.data).into_response(),
                None => (StatusCode::NOT_FOUND, "404 Not Found").into_response(),
            }
        }
    }
}

pub fn create_static_router() -> Router {
    #[cfg(feature = "embed-frontend")]
    {
        Router::new()
            .route("/", get(|| async { static_handler(axum::extract::Path(String::new())).await }))
            .route("/*path", get(static_handler))
    }

    #[cfg(not(feature = "embed-frontend"))]
    {
        // Serve directly from disk in development for live edits
        Router::new().fallback_service(
            ServeDir::new("frontend").append_index_html_on_directories(true),
        )
    }
}
