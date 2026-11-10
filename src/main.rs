mod config;
mod db;
mod llm;
mod models;
mod routes;

use config::AppConfig;
use db::Database;
use llm::LlmClient;
use routes::chat::AppState;
use routes::create_router;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ai_server=info,tower_http=info".into()),
        )
        .init();

    // Load configuration
    let config = AppConfig::from_env();
    info!("Starting AI Server for {}", config.host);

    // Initialize database
    let db = Database::new(&config.database_path)?;
    info!("SQLite database initialized at: {}", config.database_path);

    // Initialize LLM client
    let llm = Arc::new(LlmClient::new());

    // Build shared application state
    let state = AppState {
        db,
        config: config.clone(),
        llm,
    };

    // Configure CORS for mobile APK & cross-origin access
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Assemble router with middleware
    let app = create_router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    info!("🚀 AI Server running on http://{}", addr);
    info!("📱 WebUI accessible at http://{}:{}", config.host, config.port);
    info!("⚡ Default LLM model: {}", config.default_model);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received shutdown signal (Ctrl+C). Cleaning up...");
        },
        _ = terminate => {
            info!("Received SIGTERM. Cleaning up...");
        },
    }
}
