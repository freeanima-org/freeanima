---
title: Pair Programming V1
---

# Pair Programming (Studio)

> **Phase 1 ✅ shipped**: three-column layout, syntax-highlighted viewer, file tree/search, terminal, dedicated conversation platform id.
> Future work: [Issue #37](https://github.com/freeanima-org/freeanima/issues/37).

## Design Principles

- **Close the loop first**: read and discuss code with the agent in Studio
- **Read-only first**: v1 focuses on reading; agent analyzes and suggests — no direct edit/save yet
- **Platform isolation**: pair-programming sessions use a separate platform from chat chat
- **Local reads**: server reads files from a configured workspace path (set in Admin)

## Layout

```text
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
  file tree        code viewer           conversation + chat
```

| Column       | Default width | Resizable |
| ------------ | ------------- | --------- |
| Left (tree)  | 260px         | 180–400px |
| Center       | flex          | —         |
| Right (chat) | 360px         | 280–500px |

## Usage

1. Configure `satellites.pair-programming` in `~/.anima/config.yaml` (see [`satellite-guide.md`](../sap/satellite-guide.md))
2. `anima service start`
3. Open `http://127.0.0.1:4173`
4. Browse/search files on the left; view selection in the center
5. Create or select a conversation on the right; discuss code with the agent
6. Bottom terminal for debug/ops (isolated from chat conversation)

## Session Isolation

Pair programming uses platform `studio-pair-programming`, separate from chat (`chat`) and other platform conversation lists.

## Current Limitations

- Read-only viewer (highlight.js), not Monaco
- Agent cannot directly edit and save files (Phase 2)
- Workspace must be a path readable by the server process

## Related Docs

- Admin three modes: [`architecture.md`](../concepts/architecture.md)
- Security and tool risks: [`security.md`](../guide/security.md)
