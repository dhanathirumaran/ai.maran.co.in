# 📖 Project Glossary

> *"What stops 'a plausible-sounding wrong name'."*

| Term | Canonical Definition |
|:---|:---|
| **Board** (`board.md`) | The single-writer on-disk state tracker holding active tasks, backlog, completed work, and runtime invariants. |
| **Task Ticket** (`tasks/T-xxx.md`) | A structured document defining the task charter: Role, Input, Action, Output, Acceptance Criteria, and Handoff reference. |
| **Handoff** (`handoffs/H-xxx.md`) | The immutable checkpoint between steps carrying Objective, Artifact path (not content), Evidence, Status, Blockers, and Next Action. |
| **Permission Ladder** | The 3-tier security classification: 🟢 Green (read/search/test), 🟡 Yellow (edit files), 🔴 Red (external mutation/delete/publish). |
| **Login Handoff** | Pausing execution when hitting an auth wall so the human provides credentials while the agent resumes on the resulting session. |
| **Artifact** | A runnable or testable code output (HTML/SVG/JS) rendered in an isolated sandbox with live preview and code tabs. |
| **Trace** | The collapsible shadcn/Vercel AI SDK tree component showing step-by-step reasoning tokens, status icons, and duration timers. |
| **WebViewAssetLoader** | AndroidX utility that intercepts `https://appassets.androidplatform.net/assets/*` and serves files directly from APK assets without `file:///` CORS blocking. |
