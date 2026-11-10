# 📋 AGENT BOARD (Single Writer)
> **Writer Contract**: Only ONE agent/runtime writes to this board at any moment. Never concurrent writers ("two writers lose an edit with no error and no warning").

---

## 🎯 Current Mission
- **Objective**: Dedicated 1-on-1 General Bot with clean Apple light theme and in-chat memory.
- **Status**: `COMPLETE`
- **Active Task**: `tasks/T-004.md`
- **Last Handoff**: `handoffs/H-002.md`
- **Safety Mode**: `Solo Runtime (Permission Ladder Active)`

---

## 🚦 Permission Ladder Status
| Level | Permissions | Status |
|:---|:---|:---|
| 🟢 **Green** | Read files, search codebase, draft internal files, run test/build routines | Auto-Permitted |
| 🟡 **Yellow** | Edit existing codebase files (`frontend/`, `src/`, `android/`) | Inspection & Diff Log Required |
| 🔴 **Red** | Git push, delete database, publish APK release, API secret mutation | User Confirmation Gate |

---

## 📌 Task Pipeline

### 🚀 Active Task
- [`tasks/T-004.md`](tasks/T-004.md) — Dedicated 1-on-1 General Bot UI Redesign & In-Chat Memory

### 📥 Backlog (TODO)
- [`tasks/T-002.md`](tasks/T-002.md) — Autonomous Tool Calling for Search & File System in solo agent loop
- [`tasks/T-003.md`](tasks/T-003.md) — Offline SQLite Vector embeddings for localized context lookup

### ✅ Completed (DONE)
- [`tasks/T-000.md`](tasks/T-000.md) — LobeChat Glassmorphism UI, shadcn Trace reasoning stream, and live code artifacts
- [`tasks/T-001.md`](tasks/T-001.md) — Implement Solo Runtime File Contract Harness (Disk contract, Handoff schema validator, Board viewer)

---

## 🔒 Invariants & Guardrails
1. **Zero-Build Frontend**: `frontend/` must remain pure vanilla HTML5, CSS3, and ES6 JS (no Node/npm bundling steps).
2. **Artifact as Path**: Every handoff must reference an artifact *path*, never inline file content.
3. **Evidence Mandatory**: Every task transition must supply test/build/runtime evidence.
4. **Login Handoff**: External API keys/secrets are entered by the user; the agent never leaks credentials.
