---
title: Pair Programming V1
---

# Pair Programming (Studio)

> **Phase 1 ✅ shipped**: three-column layout, syntax-highlighted viewer, file tree/search, terminal, dedicated session platform id.
> Future work: [Issue #37](https://github.com/freeanima-org/freeanima/issues/37).

## Design Principles

- **Close the loop first**: read and discuss code with the agent in Studio
- **Read-only first**: v1 focuses on reading; agent analyzes and suggests — no direct edit/save yet
- **Platform isolation**: pair-programming sessions use a separate platform from parlor chat
- **Local reads**: server reads files from a configured workspace path (set in Chamber)

## Layout

```
┌──────────────────────────────────────────────────────────┐
│  Studio                  [Pair Programming] [Novel] …    │
├──────────┬────────────────────────┬──────────────────────┤
│ Search   │                        │  Session list        │
│ Files    │     Code viewer        │  ┌────────────────┐  │
│          │   (syntax highlight)   │  │ session-001    │  │
│ src/     │                        │  │ session-002    │  │
│   …      │   Read-only selected   │  ├────────────────┤  │
│          │   file view            │  │  Chat area     │  │
└──────────┴────────────────────────┴──────────────────────┘
   Left              Center                  Right
  file tree        code viewer           session + chat
```

| Column       | Default width | Resizable |
| ------------ | ------------- | --------- |
| Left (tree)  | 260px         | 180–400px |
| Center       | flex          | —         |
| Right (chat) | 360px         | 280–500px |

## Usage

1. Open `http://127.0.0.1:2658/webui/studio/pair-programming`
2. Set workspace path in Chamber (local project directory)
3. Browse/search files on the left; view selection in the center
4. Create or select a session on the right; discuss code with the agent
5. Bottom terminal for debug/ops (isolated from chat session)

## Session Isolation

Pair programming uses platform `studio-pair-programming`, separate from parlor (`parlor`) and other platform session lists.

## Current Limitations

- Read-only viewer (highlight.js), not Monaco
- Agent cannot directly edit and save files (Phase 2)
- Workspace must be a path readable by the server process

## Related Docs

- WebUI three modes: [`architecture.md`](../concepts/architecture.md)
- Security and tool risks: [`security.md`](../guide/security.md)
