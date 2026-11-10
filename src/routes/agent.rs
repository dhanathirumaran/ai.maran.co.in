// Solo Runtime File Contract Harness Endpoints
use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::{Path as StdPath, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskSummary {
    pub id: String,
    pub title: String,
    pub status: String,
    pub filename: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HandoffSummary {
    pub id: String,
    pub title: String,
    pub filename: String,
    pub status: String,
    pub artifact: String,
}

#[derive(Debug, Deserialize)]
pub struct ValidateHandoffRequest {
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub parsed: Option<HandoffParsed>,
}

#[derive(Debug, Serialize)]
pub struct HandoffParsed {
    pub objective: String,
    pub artifact: String,
    pub evidence: String,
    pub status: String,
    pub blockers: String,
    pub next_action: String,
}

/// GET /api/agent/board - Get master board.md content
pub async fn get_board() -> impl IntoResponse {
    let board_path = StdPath::new("agent/board.md");
    match fs::read_to_string(board_path) {
        Ok(content) => (
            StatusCode::OK,
            Json(json!({
                "status": "ok",
                "filename": "board.md",
                "content": content
            })),
        ),
        Err(e) => (
            StatusCode::NOT_FOUND,
            Json(json!({
                "status": "error",
                "message": format!("Failed reading board.md: {}", e)
            })),
        ),
    }
}

/// GET /api/agent/tasks - List all task tickets in agent/tasks/
pub async fn list_tasks() -> impl IntoResponse {
    let tasks_dir = StdPath::new("agent/tasks");
    let mut tasks = Vec::new();

    if let Ok(entries) = fs::read_dir(tasks_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                let filename = path.file_name().unwrap().to_string_lossy().to_string();
                if filename == "TEMPLATE.md" {
                    continue;
                }
                if let Ok(content) = fs::read_to_string(&path) {
                    let mut id = filename.replace(".md", "");
                    let mut title = "Untitled Task".to_string();
                    let mut status = "TODO".to_string();

                    for line in content.lines() {
                        let line_trimmed = line.trim();
                        if line_trimmed.starts_with("- **Task ID**:") {
                            id = line_trimmed.replace("- **Task ID**:", "").trim().replace('`', "");
                        } else if line_trimmed.starts_with("- **Title**:") {
                            title = line_trimmed.replace("- **Title**:", "").trim().to_string();
                        } else if line_trimmed.starts_with("- **Status**:") {
                            status = line_trimmed.replace("- **Status**:", "").trim().replace('`', "");
                        }
                    }

                    tasks.push(TaskSummary {
                        id,
                        title,
                        status,
                        filename,
                    });
                }
            }
        }
    }

    tasks.sort_by(|a, b| a.id.cmp(&b.id));
    (StatusCode::OK, Json(tasks))
}

/// GET /api/agent/handoffs - List all handoff checkpoints in agent/handoffs/
pub async fn list_handoffs() -> impl IntoResponse {
    let handoffs_dir = StdPath::new("agent/handoffs");
    let mut handoffs = Vec::new();

    if let Ok(entries) = fs::read_dir(handoffs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                let filename = path.file_name().unwrap().to_string_lossy().to_string();
                if filename == "TEMPLATE.md" {
                    continue;
                }
                if let Ok(content) = fs::read_to_string(&path) {
                    let id = filename.replace(".md", "");
                    let title = format!("Handoff {}", id);
                    let mut status = "UNKNOWN".to_string();
                    let mut artifact = "None".to_string();

                    let lines: Vec<&str> = content.lines().collect();
                    for (i, line) in lines.iter().enumerate() {
                        let trimmed = line.trim();
                        if trimmed.starts_with("### 2. Artifact") {
                            if let Some(next) = lines.get(i + 1) {
                                artifact = next.trim().replace('`', "");
                            }
                        } else if trimmed.starts_with("### 4. Status") {
                            if let Some(next) = lines.get(i + 1) {
                                status = next.trim().replace('`', "");
                            }
                        }
                    }

                    handoffs.push(HandoffSummary {
                        id,
                        title,
                        filename,
                        status,
                        artifact,
                    });
                }
            }
        }
    }

    handoffs.sort_by(|a, b| a.id.cmp(&b.id));
    (StatusCode::OK, Json(handoffs))
}

/// POST /api/agent/handoffs/validate - Strict File Contract Schema Validator
pub async fn validate_handoff(
    Json(payload): Json<ValidateHandoffRequest>,
) -> impl IntoResponse {
    let mut errors = Vec::new();
    let content = &payload.content;

    // Check mandatory headers
    let has_objective = content.contains("### 1. Objective");
    let has_artifact = content.contains("### 2. Artifact");
    let has_evidence = content.contains("### 3. Evidence");
    let has_status = content.contains("### 4. Status");
    let has_blockers = content.contains("### 5. Blockers");
    let has_next_action = content.contains("### 6. Next Action");

    if !has_objective {
        errors.push("Missing required section: '### 1. Objective'".to_string());
    }
    if !has_artifact {
        errors.push("Missing required section: '### 2. Artifact'".to_string());
    }
    if !has_evidence {
        errors.push("Missing required section: '### 3. Evidence'".to_string());
    }
    if !has_status {
        errors.push("Missing required section: '### 4. Status'".to_string());
    }
    if !has_blockers {
        errors.push("Missing required section: '### 5. Blockers'".to_string());
    }
    if !has_next_action {
        errors.push("Missing required section: '### 6. Next Action'".to_string());
    }

    // Extract artifact path and verify it exists on disk
    let mut artifact_path_str = String::new();
    let lines: Vec<&str> = content.lines().collect();
    for (i, line) in lines.iter().enumerate() {
        if line.trim().starts_with("### 2. Artifact") {
            if let Some(next) = lines.get(i + 1) {
                artifact_path_str = next.trim().replace('`', "");
            }
        }
    }

    if artifact_path_str.is_empty() {
        errors.push("Artifact section does not specify a valid path.".to_string());
    } else {
        let p = PathBuf::from(&artifact_path_str);
        if !p.exists() {
            errors.push(format!(
                "Artifact path '{}' was not found on disk. Rule: Artifacts must be valid existing file paths.",
                artifact_path_str
            ));
        }
    }

    let valid = errors.is_empty();
    (
        StatusCode::OK,
        Json(ValidationResult {
            valid,
            errors,
            parsed: None,
        }),
    )
}

/// GET /api/agent/context/:doc - Retrieve architectural context documents
pub async fn get_context_doc(Path(doc): Path<String>) -> impl IntoResponse {
    let clean_name = doc.replace('/', "").replace('\\', "").replace("..", "");
    let path = format!("agent/context/{}.md", clean_name);
    
    // Check if doc is charter.md
    let actual_path = if clean_name == "charter" {
        "agent/charter.md".to_string()
    } else {
        path
    };

    match fs::read_to_string(&actual_path) {
        Ok(content) => (
            StatusCode::OK,
            Json(json!({
                "status": "ok",
                "doc": clean_name,
                "content": content
            })),
        ),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(json!({
                "status": "error",
                "message": format!("Context document '{}' not found", clean_name)
            })),
        ),
    }
}
