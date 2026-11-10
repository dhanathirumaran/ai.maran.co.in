# 🏛️ System Architecture Context

## 1. High-Level Topology
`ai.maran.co.in` is a dual-runtime, full-stack personal AI system:

```
┌─────────────────────────────────────────────────────────────────┐
│                       Clients Layer                             │
│  ┌─────────────────────────┐       ┌─────────────────────────┐  │
│  │   Desktop / Web Browser │       │  Android APK (Native)   │  │
│  │   (Axum static serve)   │       │   WebViewAssetLoader    │  │
│  └───────────┬─────────────┘       └────────────┬────────────┘  │
│              │                                  │               │
│              ▼                                  ▼               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │        Frontend (Vanilla HTML5 / CSS3 / ES6 JS)           │  │
│  │   - LobeChat Frosted Glassmorphism Design System          │  │
│  │   - shadcn Trace & Chain-of-Thought Stream Component      │  │
│  │   - Live Code Artifacts Sandbox (iframe + fullscreen)     │  │
│  │   - Native Web Speech API Voice Synthesis (TTS)           │  │
│  │   - Direct OpenAI-compatible Gateway Mode (PulseMind Omni)│  │
│  └───────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │ (SSE / JSON)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Server Layer                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Rust Axum Web Server                    │  │
│  │   - tokio async multithreaded runtime                     │  │
│  │   - tower_http CORS & static asset serving                │  │
│  │   - SQLite WAL database (conversations, messages, persona)│  │
│  │   - OpenAI-compatible reverse proxy with SSE token stream │  │
│  │   - Agent File Contract & Handoff Management API          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Directory Layout & Isolation
- `/frontend`: Self-contained, zero-build client assets (`index.html`, `styles.css`, `app.js`, `vendor/`).
- `/android`: Android application wrapper using `androidx.webkit.WebViewAssetLoader` mapping `https://appassets.androidplatform.net/assets/` to `android/app/src/main/assets/`.
- `/src`: Rust Axum backend implementation (`main.rs`, `routes/`, `db.rs`, `llm.rs`, `models.rs`, `config.rs`).
- `/agent`: On-disk autonomous file contract harness (`board.md`, `tasks/`, `handoffs/`, `context/`, `charter.md`).
- `/.github/workflows`: CI/CD pipeline building, verifying, and releasing APK packages automatically on push to `main`.
