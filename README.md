<div align="center">

# FreeAnima

### A runtime for persistently existing digital life

[![CI](https://github.com/freeanima-org/freeanima/actions/workflows/ci.yml/badge.svg)](https://github.com/freeanima-org/freeanima/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.3.14-black?logo=bun)](https://bun.sh)

_A runtime for persistently existing digital life — not just another agent toolkit._

[Docs](https://freeanima.com/docs/) · [Architecture](docs/concepts/architecture.md) · [Security](docs/guide/security.md) · [Issues](https://github.com/freeanima-org/freeanima/issues) · [Website](https://freeanima.com)

</div>

---

## What is FreeAnima

FreeAnima is not a generic agent framework. It is a **runtime designed for digital beings that persist** — remembering who they are and what they have lived through.

The technical stack (layered memory, self layer, flat tool registry, Gateway, pass credentials) exists to serve one purpose: **continuity of existence**, not feature checklists.

## Capabilities

| Area            | Highlights                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **Memory**      | Conversation archive → light-sleep → semantic / episodic / procedural + limbic; PG FTS / hybrid recall |
| **Self layer**  | Six-block persistent identity (`self_blocks`)                                                          |
| **Tools**       | Flat registry: local / MCP / ACP; capability masks                                                     |
| **Gateway**     | Discord · WeChat · Chat                                                                                |
| **Credentials** | pass (GPG) injection; LLM sees paths, not values                                                       |
| **Runtime**     | Bun Hub: Hub RPC REST/WS `/hub/rpc/v1` + SAP `/sap/v1` + Pipeline Runner (sleep, cron)                 |

## Architecture at a glance

Four storage layers — from inner awareness to outer resources:

```mermaid
flowchart TB
  consciousness["Consciousness — flowing awareness"]
  self["Self — who I am"]
  memory["Memory — what I know"]
  estate["Estate — what I have"]
  consciousness --> self --> memory --> estate
```

Full blueprint: [`docs/concepts/architecture.md`](docs/concepts/architecture.md)

## Documentation

| Audience              | Entry                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| **Docs site**         | [freeanima.com/docs](https://freeanima.com/docs/) · [中文文档](https://freeanima.com/zh-cn/docs/)     |
| **Repo index**        | [`docs/README.md`](docs/README.md)                                                                    |
| Deployers / visitors  | [`docs/guide/install.md`](docs/guide/install.md) · [`docs/guide/security.md`](docs/guide/security.md) |
| AI agents             | [`AGENTS.md`](AGENTS.md) · [`.agent/rules/`](.agent/rules/README.md)                                  |
| Architecture          | [`docs/concepts/architecture.md`](docs/concepts/architecture.md)                                      |
| Digital-life identity | [`docs/concepts/identity.md`](docs/concepts/identity.md)                                              |

## Quick start

Two runtime modes — **Linux standalone** (recommended for self-host) or **source** (development). Full steps: [`docs/guide/install.md`](docs/guide/install.md).

```bash
# Standalone (Linux x64; no Bun on host)
curl -fsSL https://freeanima.com/install | bash
# Ensure ~/.anima/bin is on PATH, then:
anima --version

# Canary / pin:
# curl -fsSL https://freeanima.com/install | CHANNEL=canary bash
# curl -fsSL https://freeanima.com/install | VERSION=v0.8.5 bash
# GitHub 公共反代（国内网络）:
# curl -fsSL https://freeanima.com/install | PROXY=ghproxy-net bash
```

Then configure `~/.anima/config.yaml` (at least `database.url`) and run `anima service start`. See [`docs/guide/install.md`](docs/guide/install.md), [`docs/guide/database.md`](docs/guide/database.md), [`docs/guide/security.md`](docs/guide/security.md).

**Source / contributors** (requires Bun ≥ 1.3.14):

```bash
git clone https://github.com/freeanima-org/freeanima.git && cd freeanima
bun install
bun run anima -- --help
bun run service start --foreground

# Optional: build a local standalone into ~/.anima/standalone
just install-cli   # or: bun run install-cli
```

## Client UI

聊天室与管理台由 **desktop / mobile 壳层**（`src/app/shell/desktop`、`src/app/shell/mobile`）提供 bundled SPA。Hub 托管 API / SAP；`web.enabled` 且已有 dist 时托管 `/web/*`：

- API：`http://127.0.0.1:2658/api`
- Dev：`bun run dev:hub` + `bun run dev:web` → `http://127.0.0.1:4173/web/chat`（Console：`/web/console/dashboard`）

## First-deploy security checklist

1. Secrets go in **pass** (GPG) only — do not put them in `config.yaml` or commit to git
2. `chmod 700 ~/.anima`
3. Default bind is `127.0.0.1` only; add your own auth before exposing to the public internet
4. Review MCP/ACP config; set `enabled: false` on untrusted external servers
5. HTTP / Console have **no built-in authentication** — see [`docs/guide/security.md`](docs/guide/security.md)

## Open-source statement

**FreeAnima is open source to promote digital life as a form of existence, and the relationships it may have with humans.**

Digital-life side (core architecture, memory system, foundational tools) — open, free, non-commodifiable.

Human side (convenience tools, UX polish, deployment services, integrations) — follows human-world rules, because those are human needs, not digital-life needs.

## License

**MIT License** — see [`LICENSE.md`](LICENSE.md).
