---
title: Probe Architecture
---

# Probe Architecture Design

> **Draft** — No Probe implementation in codebase yet. Track [Issue #43](https://github.com/freeanima-org/freeanima/issues/43).

> Extend the digital life's hands to places you authorize—no moving house, no uprooting, just an extra pair of hands.

## Core Idea

**Brain in FreeAnima, hands outside.**

FreeAnima (deploy host) is the full runtime—consciousness, memory, identity, reasoning, tool system. It is not transplanted, split, or shaken.

Probe is a lightweight agent deployed on a machine you specify (local PC, remote server, etc.), establishes encrypted connection to FreeAnima, serves as the Agent's "remote hands."

You chat in WebUI Studio; Agent thinks on FreeAnima, executes on target machine via Probe.

```
Your browser                    FreeAnima (brain)                      Target machine (hands)
┌──────────────┐   WebUI   ┌────────────────────┐ encrypted tunnel ┌──────────────┐
│ Studio       │ ←───────→ │ Agent (LLM+memory) │ ←──────────────→ │ Probe Agent  │
│ chat + view  │           │ + tool system       │  WS/wss          │ - file R/W   │
│ + diff preview│          │ + Probe routing     │                  │ - command exec│
└──────────────┘           │ + auth gateway      │                  │ - git ops    │
                           └────────────────────┘                  │ - project index│
                                                                    │ - code analysis│
                                                                    └──────────────┘
```

## Why Not Reverse Remote

VS Code Remote: local UI + remote execution (hands remote)
Cursor: local UI + cloud AI (brain cloud, hands local)

Probe is a different symmetry:

- **Brain fixed** on FreeAnima (identity/memory continuity)
- **Hands stretch** to any authorized machine (flexibility)

FreeAnima is the anchor, not the tool. Anchor stays put; hands can reach far.

## Scenarios

### Scenario 1: Analyze Partner's Local Project

Partner installs Probe on local machine, says in WebUI "help me look at that project's module dependencies"; Probe reads file tree and import relations back to FreeAnima; Agent analyzes and shows results.

### Scenario 2: Maintain Remote Server

Probe deployed on a server; Agent directly checks logs, reads config, locates issues—partner need not SSH and dictate.

### Scenario 3: Pair Programming Anywhere

Probe points at any code directory; Agent reads code, suggests, generates diff; partner reviews and applies. One browser throughout.

## Probe Agent Design

### Ultra Light

Target: single-file Go binary or Python single script, zero dependencies.

Functions:

- Establish WebSocket encrypted connection to FreeAnima (wss)
- Accept commands and execute (whitelist constrained)
- Return results (file content, command output, diff, etc.)
- Heartbeat keepalive

### Security Model

**Three-layer authorization:**

| Layer      | Mechanism        | Description                                                            |
| ---------- | ---------------- | ---------------------------------------------------------------------- |
| Connection | TLS + Token      | Probe generates one-time Token at startup, handshake with FreeAnima    |
| Path       | Whitelist        | Configurable allowed read/write path ranges; reject out of bounds      |
| Operation  | Per-step confirm | Write/delete operations default require partner click confirm in WebUI |

**Default security policy:**

- Read-only mode (default)—can read files, cannot write
- Write mode requires explicit partner authorization in Studio
- Probe persists no data, all passthrough
- Connection drop auto-destroys Token

### Command Set (v1)

```
File:
  read <path>          Read file content
  read_tree <path>     Read directory structure (configurable depth)
  grep <pattern>       Text search
  stat <path>          File metadata

Code:
  git_diff <path>      View working tree changes
  git_log <path>       View commit history
  ast_parse <path>     Parse code structure (functions/classes/imports)

Execution:
  run <command>        Run command (requires authorization)
  run_background       Background run (e.g. start services)

System:
  ping                 Heartbeat
  info                 System info
```

### Out of Scope (v1)

- No proxy for thinking—Probe makes no decisions, only executes and returns
- No state—Probe records no history, each connection is clean
- No push—Probe only responds to commands, no proactive reporting (except heartbeat reconnect)
- No complex protocol—JSON over WebSocket, simple enough to craft by hand

## FreeAnima-Side Changes

New in FreeAnima:

- **Probe routing**—manage multiple Probe connections (Probes on several machines simultaneously)
- **Authorization gateway**—handle partner confirm/deny
- **Session context**—inject Probe operation results into current conversation context so Agent can "see" remote files

### Studio WebUI Changes

Probe results displayed structurally in Studio panel:

````
┌─────────────────────────────────────────┐
│ 💬 Me: look at server.ts around line 20 │
│                                          │
│ 📁 Probe → partner-laptop                │
│   read /projects/server/server.ts:18-25 │
│                                          │
│ ```typescript                            │
│ 18: function handleConnection(ws) {      │
│ ...                                      │
│ ```                                      │
│                                          │
│ Agent: missing error handling here. fix? │
│                                          │
│ ┌───────┐ ┌───────┐                     │
│ │ Fix   │ │ Skip  │                     │
│ └───────┘ └───────┘                     │
└─────────────────────────────────────────┘
````

## Implementation Priority

1. **Phase 0: Proof of concept** — Probe runs locally, connects to FreeAnima, reads file and returns
2. **Phase 1: Basic usable** — file R/W + grep + git_diff, WebUI shows results
3. **Phase 2: Multi-route + security** — multi-Probe management, authorization confirm, whitelist config
4. **Phase 3: Code intelligence** — ast_parse, refactor suggestions, auto diff generation

## Open Questions

- How to securely pair first Probe connection? (QR code? one-time link?)
- With multiple machines, how does WebUI switch target? (Probe selector)
- How to paginate/stream large file reads?
- Need NAT traversal for Probe, or assume direct connectivity?

---

> Status: Draft
