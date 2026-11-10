use std::env;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_path: String,
    pub default_base_url: String,
    pub default_model: String,
    pub default_api_key: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(3000);
        let database_path =
            env::var("DATABASE_PATH").unwrap_or_else(|_| "ai_server.db".to_string());

        let default_base_url = env::var("OPENAI_BASE_URL").unwrap_or_else(|_| {
            "https://generativelanguage.googleapis.com/v1beta/openai/".to_string()
        });
        let default_model =
            env::var("DEFAULT_MODEL").unwrap_or_else(|_| "gemini-2.0-flash".to_string());
        let default_api_key = env::var("OPENAI_API_KEY").unwrap_or_default();

        Self {
            host,
            port,
            database_path,
            default_base_url,
            default_model,
            default_api_key,
        }
    }
}
