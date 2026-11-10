# 📏 Development Conventions & Guidelines

## 1. Zero-Build Frontend Rule
- **Strict Invariant**: No Node.js build pipelines, Webpack, Vite, or Babel compilers are allowed in the frontend.
- All code must run natively in modern web browsers and Android System WebView (Chromium 100+).
- Libraries must be vendored as standalone, minified UMD/vanilla scripts in `frontend/vendor/` (e.g. `marked.min.js`, `highlight.min.js`).

## 2. File Contract & Handoff Rule
- **Artifact as Path**: A handoff document must NEVER duplicate or embed entire source code. It must state:
  ```markdown
  Artifact: `path/to/file.ext`
  ```
- **Evidence Mandatory**: Every handoff must cite tangible evidence:
  ```markdown
  Evidence: `node -c frontend/app.js` exited 0; APK compiled at `latest-apk/app-debug.apk` (5.7 MB)
  ```
- **Single-Writer Board**: Only one agent or process may update `agent/board.md` at a time. Changes must be atomic.

## 3. Security & Safety Conventions
- Never commit unencrypted API keys or passwords.
- Always use `.env` or `localStorage` masking.
- Sensitive user commands (delete all conversations, force git push) fall under the **🔴 RED** permission ladder and require manual human validation.
