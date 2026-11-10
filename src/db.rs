use crate::models::{Conversation, Message, Persona};
use chrono::Utc;
use rusqlite::{params, Connection, Result};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;

        // Enable Write-Ahead Logging (WAL) for concurrency & fast writes
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        db.initialize_schema()?;
        db.seed_default_personas()?;

        Ok(db)
    }

    fn initialize_schema(&self) -> Result<()> {
        let conn = self.conn.blocking_lock();

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT NOT NULL,
                system_prompt TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant')),
                content TEXT NOT NULL,
                attachments_json TEXT,
                tokens INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_messages_conversation 
                ON messages(conversation_id, created_at);

            CREATE TABLE IF NOT EXISTS personas (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                system_prompt TEXT NOT NULL,
                is_builtin INTEGER DEFAULT 0
            );
            ",
        )?;

        Ok(())
    }

    fn seed_default_personas(&self) -> Result<()> {
        let conn = self.conn.blocking_lock();

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM personas WHERE is_builtin = 1",
            [],
            |r| r.get(0),
        )?;

        if count == 0 {
            let defaults = [
                (
                    "general",
                    "General Assistant",
                    "Helpful, knowledgeable, and direct assistant",
                    "You are a helpful, accurate, and concise AI assistant. Provide clear, direct answers without unnecessary fluff.",
                ),
                (
                    "coding",
                    "Software Architect",
                    "Senior engineer for clean code, architecture, and debugging",
                    "You are an expert software engineer and architect. Provide clean, secure, idiomatic code with explanations. Prioritize best practices, modularity, and error handling.",
                ),
                (
                    "writer",
                    "Creative & Technical Writer",
                    "Polished prose, documentation, and storytelling",
                    "You are a master writer and editor. Craft clear, engaging, and beautifully formatted text suitable for professional documentation, blogs, or creative writing.",
                ),
                (
                    "analyst",
                    "Concise Analyst",
                    "Critical thinking, structured breakdowns, and actionable takeaways",
                    "You are an analytical consultant. Deconstruct complex problems into structured key points, trade-offs, and clear recommendations with bullet points.",
                ),
            ];

            for (id, title, desc, prompt) in defaults {
                conn.execute(
                    "INSERT OR IGNORE INTO personas (id, title, description, system_prompt, is_builtin)
                     VALUES (?1, ?2, ?3, ?4, 1)",
                    params![id, title, desc, prompt],
                )?;
            }
        }

        Ok(())
    }

    // Conversations CRUD
    pub async fn list_conversations(&self) -> Result<Vec<Conversation>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, title, model, system_prompt, created_at, updated_at 
             FROM conversations 
             ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                system_prompt: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        let mut conversations = Vec::new();
        for r in rows {
            conversations.push(r?);
        }
        Ok(conversations)
    }

    pub async fn get_conversation(&self, id: &str) -> Result<Option<Conversation>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, title, model, system_prompt, created_at, updated_at 
             FROM conversations WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                system_prompt: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        if let Some(res) = rows.next() {
            Ok(Some(res?))
        } else {
            Ok(None)
        }
    }

    pub async fn create_conversation(
        &self,
        id: &str,
        title: &str,
        model: &str,
        system_prompt: Option<&str>,
    ) -> Result<Conversation> {
        let now = Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        conn.execute(
            "INSERT INTO conversations (id, title, model, system_prompt, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, title, model, system_prompt, now, now],
        )?;

        Ok(Conversation {
            id: id.to_string(),
            title: title.to_string(),
            model: model.to_string(),
            system_prompt: system_prompt.map(String::from),
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn update_conversation(
        &self,
        id: &str,
        title: Option<&str>,
        model: Option<&str>,
        system_prompt: Option<&str>,
    ) -> Result<bool> {
        let now = Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        let mut updates = Vec::new();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(t) = title {
            updates.push(format!("title = ?{}", params_vec.len() + 1));
            params_vec.push(Box::new(t.to_string()));
        }
        if let Some(m) = model {
            updates.push(format!("model = ?{}", params_vec.len() + 1));
            params_vec.push(Box::new(m.to_string()));
        }
        if let Some(sp) = system_prompt {
            updates.push(format!("system_prompt = ?{}", params_vec.len() + 1));
            params_vec.push(Box::new(sp.to_string()));
        }

        if updates.is_empty() {
            return Ok(false);
        }

        updates.push(format!("updated_at = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(now));

        let query = format!(
            "UPDATE conversations SET {} WHERE id = ?{}",
            updates.join(", "),
            params_vec.len() + 1
        );
        params_vec.push(Box::new(id.to_string()));

        let slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
        let affected = conn.execute(&query, slice.as_slice())?;
        Ok(affected > 0)
    }

    pub async fn delete_conversation(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().await;
        let affected = conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])?;
        Ok(affected > 0)
    }

    // Messages
    pub async fn get_messages(&self, conversation_id: &str) -> Result<Vec<Message>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, conversation_id, role, content, attachments_json, tokens, created_at 
             FROM messages 
             WHERE conversation_id = ?1 
             ORDER BY created_at ASC",
        )?;

        let rows = stmt.query_map(params![conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                attachments_json: row.get(4)?,
                tokens: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut messages = Vec::new();
        for r in rows {
            messages.push(r?);
        }
        Ok(messages)
    }

    pub async fn add_message(
        &self,
        id: &str,
        conversation_id: &str,
        role: &str,
        content: &str,
        attachments_json: Option<&str>,
    ) -> Result<Message> {
        let now = Utc::now().timestamp_millis();
        let conn = self.conn.lock().await;

        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, attachments_json, tokens, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
            params![id, conversation_id, role, content, attachments_json, now],
        )?;

        // Update conversation updated_at
        conn.execute(
            "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
            params![now, conversation_id],
        )?;

        Ok(Message {
            id: id.to_string(),
            conversation_id: conversation_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
            attachments_json: attachments_json.map(String::from),
            tokens: 0,
            created_at: now,
        })
    }

    // Personas CRUD
    pub async fn list_personas(&self) -> Result<Vec<Persona>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, system_prompt, is_builtin 
             FROM personas 
             ORDER BY is_builtin DESC, title ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            let is_builtin_int: i32 = row.get(4)?;
            Ok(Persona {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                system_prompt: row.get(3)?,
                is_builtin: is_builtin_int == 1,
            })
        })?;

        let mut personas = Vec::new();
        for r in rows {
            personas.push(r?);
        }
        Ok(personas)
    }

    pub async fn create_persona(
        &self,
        id: &str,
        title: &str,
        description: Option<&str>,
        system_prompt: &str,
    ) -> Result<Persona> {
        let conn = self.conn.lock().await;
        conn.execute(
            "INSERT INTO personas (id, title, description, system_prompt, is_builtin)
             VALUES (?1, ?2, ?3, ?4, 0)",
            params![id, title, description, system_prompt],
        )?;

        Ok(Persona {
            id: id.to_string(),
            title: title.to_string(),
            description: description.map(String::from),
            system_prompt: system_prompt.to_string(),
            is_builtin: false,
        })
    }

    pub async fn delete_persona(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().await;
        let affected = conn.execute(
            "DELETE FROM personas WHERE id = ?1 AND is_builtin = 0",
            params![id],
        )?;
        Ok(affected > 0)
    }
}
