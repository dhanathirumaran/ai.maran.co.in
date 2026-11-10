# AI Studio &bull; Rust AI Server & WebUI

> A blazing-fast, lightweight, cross-platform AI server written in **Rust (Axum + Tokio)** with a responsive, zero-build **HTML5/CSS3/Vanilla JS** WebUI. 
> Designed for desktop/VPS hosting (`ai.maran.co.in`) and direct packaging into **Android APKs** as a background service or embedded WebView application.

[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Axum](https://img.shields.io/badge/framework-Axum%200.7-blueviolet)](https://github.com/tokio-rs/axum)

---

## ✨ Features

- **Multi-Provider AI Gateway**: Seamless OpenAI-compatible protocol layer working out-of-the-box with **Google Gemini**, **OpenAI**, **Groq**, **Ollama**, **DeepSeek**, and **OpenRouter**.
- **Real-Time Streaming**: Server-Sent Events (SSE) with instant cancellation via `AbortController`.
- **Embedded Persistence**: Zero-setup, file-based SQLite database with Write-Ahead Logging (`WAL`) storing conversations, messages, and personas.
- **Pure Vanilla WebUI**: No Node.js, npm, or webpack required! Served directly by Axum with live reloading in development and optional single-binary embedding for production release.
- **Multimodal Support**: Send images (`image/png`, `image/jpeg`, `image/webp`) and text/code files directly in the chat.
- **System Personas & Prompt Presets**: Switch personas (Software Architect, General Assistant, Creative Writer, Concise Analyst) or add custom system instructions.
- **Mobile-First & Touch Optimized**: Drawer navigation, responsive layout, dark/light theme switching, and auto-growing composer.
- **Android APK Ready**: Zero C-dependencies on OpenSSL (uses pure-Rust `rustls-tls` and bundled `rusqlite`), ensuring seamless cross-compilation for `aarch64-linux-android`.

---

## 🏗️ Architecture

```
                                  +------------------------------------+
                                  |   Client Tier (Mobile / Desktop)   |
                                  |   Vanilla HTML5 + Modern CSS + JS  |
                                  +-----------------+------------------+
                                                    |
                                    HTTP REST / SSE | (/api/chat/stream)
                                                    v
+---------------------------------------------------+-----------------------------------+
| Rust Server (Axum + Tokio)                                                            |
|                                                                                       |
|   +-----------------------+     +-----------------------+     +-------------------+   |
|   |  Routes & Middleware  | --> |  LLM Adapter (Reqwest | --> |  SQLite Database  |   |
|   |  (CORS, Trace, Serve) |     |  with rustls-tls)     |     |  (rusqlite WAL)   |   |
|   +-----------------------+     +-----------+-----------+     +-------------------+   |
+---------------------------------------------|-----------------------------------------+
                                              |
                     HTTPS Stream (OpenAI API | Protocol)
                                              v
               +-------------------------------------------------------------+
               | Upstream AI Providers                                       |
               | - Google Gemini (gemini-2.0-flash via OpenAI endpoint)      |
               | - OpenAI (gpt-4o, o1, o3-mini)                              |
               | - Groq (llama-3.3-70b-versatile, ultra low latency)         |
               | - Local Ollama (llama3.2, mistral, deepseek-r1)             |
               +-------------------------------------------------------------+
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Rust Toolchain**: [Install Rust](https://rustup.rs/) (1.75+ recommended):
  ```bash
  # Windows (via winget or rustup-init):
  winget install Rustlang.Rustup

  # Linux / macOS:
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

### 2. Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
Edit `.env` with your preferred AI provider key:
```env
HOST=127.0.0.1
PORT=3000
DATABASE_PATH=ai_server.db

# Example: Google Gemini via OpenAI endpoint
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
DEFAULT_MODEL=gemini-2.0-flash
OPENAI_API_KEY=your_gemini_api_key_here
```

### 3. Run Development Server
```bash
cargo run
```
Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.
Any edits to `frontend/index.html`, `styles.css`, or `app.js` update immediately upon browser refresh!

---

## 📦 Single-Binary Production Build

To compile a single, self-contained executable with the frontend assets embedded directly into the binary:
```bash
cargo build --release --features embed-frontend
```
The resulting binary (`target/release/ai-server` or `ai-server.exe`) runs anywhere without needing the `frontend/` folder!

---

## 📱 Compiling for Android (APK Integration)

Because the project relies exclusively on pure-Rust networking (`rustls`) and self-contained SQLite (`rusqlite bundled`), cross-compiling to Android is straightforward.

### Option A: Standalone Daemon inside Android
1. Install Android NDK and `cargo-ndk`:
   ```bash
   cargo install cargo-ndk
   rustup target add aarch64-linux-android
   ```
2. Build for ARM64:
   ```bash
   cargo ndk -t arm64-v8a build --release --features embed-frontend
   ```
3. Include the compiled binary inside an Android Studio project's `assets` or `jniLibs/arm64-v8a/` directory. An Android background service spawns the binary on `127.0.0.1:8080`, and an Android `WebView` simply navigates to `http://127.0.0.1:8080/`.

### Option B: Tauri v2 Mobile
You can wrap this repository into a native APK using Tauri v2:
```bash
cargo tauri android init
cargo tauri android build
```

---

## 🌐 Production Reverse Proxy (ai.maran.co.in)

### Caddy Reverse Proxy (Recommended for automatic SSL)
```caddy
ai.maran.co.in {
    reverse_proxy 127.0.0.1:3000 {
        # Enable streaming support for SSE
        header_up X-Accel-Buffering no
    }
}
```

### Nginx Configuration
```nginx
server {
    server_name ai.maran.co.in;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 🔌 REST & SSE API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/conversations` | List conversation threads |
| `POST` | `/api/conversations` | Create a new conversation thread |
| `GET` | `/api/conversations/:id` | Get conversation and full message history |
| `PATCH` | `/api/conversations/:id` | Update title or parameters |
| `DELETE` | `/api/conversations/:id` | Delete conversation and messages |
| `POST` | `/api/chat/stream` | Stream LLM response via SSE (`text/event-stream`) |
| `GET` | `/api/personas` | List built-in and custom prompt personas |
| `POST` | `/api/personas` | Create a custom prompt persona |
| `DELETE` | `/api/personas/:id` | Delete a custom persona |

---

## 📄 License
Released under the [MIT License](LICENSE).
