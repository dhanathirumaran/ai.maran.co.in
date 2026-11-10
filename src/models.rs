use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub model: String,
    pub system_prompt: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub name: String,
    pub mime_type: String,
    pub data_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub attachments_json: Option<String>,
    pub tokens: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Persona {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub system_prompt: String,
    pub is_builtin: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateConversationPayload {
    pub title: Option<String>,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConversationPayload {
    pub title: Option<String>,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePersonaPayload {
    pub title: String,
    pub description: Option<String>,
    pub system_prompt: String,
}

#[derive(Debug, Deserialize)]
pub struct ChatStreamPayload {
    pub conversation_id: Option<String>,
    pub message: String,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub attachments: Option<Vec<Attachment>>,
}

#[derive(Debug, Serialize)]
pub struct ConversationDetail {
    pub conversation: Conversation,
    pub messages: Vec<Message>,
}

// Structures for communicating with OpenAI-compatible upstream API
#[derive(Debug, Serialize)]
pub struct OpenAIChatRequest {
    pub model: String,
    pub messages: Vec<OpenAIMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    pub stream: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct OpenAIMessage {
    pub role: String,
    pub content: OpenAIContent,
}

#[derive(Debug, Serialize, Clone)]
#[serde(untagged)]
pub enum OpenAIContent {
    Text(String),
    Parts(Vec<OpenAIContentPart>),
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum OpenAIContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image_url")]
    ImageUrl { image_url: OpenAIImageUrl },
}

#[derive(Debug, Serialize, Clone)]
pub struct OpenAIImageUrl {
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenAIChatChunk {
    pub id: Option<String>,
    pub choices: Option<Vec<OpenAIChoiceChunk>>,
}

#[derive(Debug, Deserialize)]
pub struct OpenAIChoiceChunk {
    pub delta: Option<OpenAIDelta>,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OpenAIDelta {
    pub role: Option<String>,
    pub content: Option<String>,
    pub reasoning_content: Option<String>,
}
