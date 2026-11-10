# 📜 Agent Charter & Safety Protocol

> **Core Philosophy**: *"Handoff quality is a file format problem, not a prompting problem. Build this before the chat surface."*

---

## 1. Execution Lifecycle Contract
Every task execution follows a strict unidirectional workflow:
```
Role ──▶ Input ──▶ Action ──▶ Output ──▶ Acceptance Criteria ──▶ Handoff
```

1. **Role**: The defined persona and scope (e.g., Solo System Engineer, UI Architect, Runtime Auditor).
2. **Input**: Explicit prerequisite file paths or artifacts (e.g. `context/architecture.md`, existing code).
3. **Action**: The deterministic, bounded set of changes or commands executed.
4. **Output**: Generated artifacts placed in `/workspace` or designated paths.
5. **Acceptance Criteria**: Verifiable assertions (e.g., `node -c app.js` succeeds, API returns 200, APK builds without warnings).
6. **Handoff**: Structured document placed in `handoffs/H-xxx.md` recording objective, artifact path, evidence, status, blockers, and next action.

---

## 2. Permission Ladder

The runtime operates under a tiered 3-stage security ladder:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🟢 GREEN: Read, search, draft internal files, run saved routines│
├─────────────────────────────────────────────────────────────────┤
│ 🟡 YELLOW: Edit existing repository files (diff inspection)     │
├─────────────────────────────────────────────────────────────────┤
│ 🔴 RED: Send, publish, buy, delete, sign (always ask human gate)│
└─────────────────────────────────────────────────────────────────┘
```

- **🟢 Green Actions (Auto-Allowed)**:
  - Reading any repository file (`read_file`).
  - Searching codebase, regex lookups, git status/diff inspections.
  - Writing scratch scripts or drafting new task tickets in `agent/tasks/`.
  - Running standard read-only commands and lint/syntax checks.
- **🟡 Yellow Actions (Controlled Mutation)**:
  - Editing existing source files (`frontend/`, `src/`, `android/`).
  - Modifying application configuration or schemas.
  - Pre-condition: Must log clean diffs and verify syntax.
- **🔴 Red Actions (Always Require Confirmation)**:
  - Deleting conversations, database tables, or repository history.
  - Pushing to remote production repositories or releasing APKs to public users.
  - Exposing or transmitting API keys, credentials, or private secrets.

---

## 3. Login Handoff Protocol
When authentication, multi-factor verification, or API key configuration is required:
> *"The agent drives until a login wall, hands you the screen, resumes on the same session. The bot ends up with a session. You keep the secret."*

- **Protocol**:
  1. The agent detects missing or unconfigured credentials.
  2. The agent pauses execution and displays a masked credential prompt or triggers the Settings modal on screen.
  3. The user inputs their key or completes MFA.
  4. The runtime detects key presence in local storage/environment and automatically resumes without storing raw secrets in code or commits.
