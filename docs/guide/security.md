---
title: Security
---

# FreeAnima Security

> Adopted principles: [architecture.md](../concepts/architecture.md).
> Security review and implementation items: [GitHub Issue #33](https://github.com/freeanima-org/freeanima/issues/33), [#46](https://github.com/freeanima-org/freeanima/issues/46).

## Trust Model (Required Reading for Open-Source Deployment)

FreeAnima is designed for **single-user local / intranet** deployment:

- HTTP / WebUI **has no auth by default**; binding `127.0.0.1` is not security—any process or user that can reach the port can read conversations, send messages, start/stop MCP/ACP.
- Default bind is `127.0.0.1`; for LAN access, assess CORS and network isolation yourself.
- **Do not** expose the service to the public internet without `remote_auth` (see [`remote-access.md`](remote-access.md) — Tunnel + Bearer token).

## Credential Responsibilities

| Rule                     | Description                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sole authoritative store | [pass](https://www.passwordstore.org/) (GPG, `~/.password-store`)                                                                                                                                               |
| Never commit secrets     | Do not write API keys, tokens, DB passwords into `config.yaml` and commit to git                                                                                                                                |
| Runtime directory        | `~/.anima/` (`FREEANIMA_HOME` overridable) holds config, conversations, memory—recommend `chmod 700`                                                                                                            |
| CLI plaintext output     | `anima credential get` prints plaintext to stdout; do not redirect to shared logs                                                                                                                               |
| WebUI credential detail  | `GET /api/credentials/detail?path=` returns pass plaintext to local WebUI; same sensitivity as CLI; relies on bind address and process isolation                                                                |
| pass path conventions    | `api/opencode-go`, `services/cloudflare/api-token`, `services/cloudflare/tunnel-credentials`, `services/discord`, `services/firecrawl`, `services/postgres/anima`, `services/pushdeer`, `services/weixin-ilink` |

`config.yaml` supports `credential("path", "field")` and `env("KEY")` for secrets (e.g. `database.url: credential("services/postgres/anima", "url")` or `env("DATABASE_URL")`); values are injected at runtime from pass or the environment.

## Data Persistence

| Path                            | Content             | Encryption                      |
| ------------------------------- | ------------------- | ------------------------------- |
| PostgreSQL conversation archive | sessions / messages | No application-layer encryption |
| `~/.anima/weixin/`              | WeChat sync state   | None                            |

Disk backup = data access. Protect backup media accordingly.

## LLM Tool Risks

| Capability             | Risk                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `terminal`             | Default `shell: true`, can run arbitrary shell commands                                                             |
| `file_read_file`       | Partial path deny (`.ssh` private keys, `/etc/passwd`, etc.); **not** full `/etc/` deny                             |
| `file_write_file`      | deny list + write-protected paths                                                                                   |
| MCP tools              | Capabilities entirely determined by external Server; stdio default, SSE auth scheme not fully defined               |
| Capability mask (Mask) | Conversation-level tool whitelist; `deny` overrides `allow`; LLM cannot see policy details; see `capabilities/mask` |
| ACP (Cursor)           | Default **auto-approve** all `session/request_permission` (`allow-once`)                                            |
| `credentials_list`     | Returns pass path metadata only, no values                                                                          |

## Measures in Place

| Measure                 | Description                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Same-origin RPC         | TanStack Start server functions same-origin by default, no CORS whitelist needed                                   |
| Config secret redaction | `AppRuntime.getConfig()` → `sanitizeConfigForApi()` (`api_key`, `database.url`, nested `pushkey`, `mcp env`, etc.) |
| MCP config redaction    | `sanitizeMcpConfig`: `env` exposes only `env_keys`                                                                 |
| Write path safety       | `file_write_file` deny list (partial `/etc/*`, `.ssh` private keys, etc.)                                          |
| Slash commands          | Whitelist routing                                                                                                  |
| MCP default stdio       | Reduces port exposure                                                                                              |
| Credential isolation    | LLM sees pass paths only, not values                                                                               |
| CI secret scanning      | `.github/workflows/security.yml` (Gitleaks); GitHub Secret scanning + Push protection (free for public repos)      |
| `.gitignore`            | `.env.*`, `config.yaml`, private key suffixes                                                                      |

## Known Gaps (Documentation ≠ Fully Implemented)

The following are planned in code or docs—**deployers must not assume implemented**:

| Priority | Item                                                  | Status                                                                                                                       |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| P0       | file_read_file full deny (`/etc/` etc.)               | Partial                                                                                                                      |
| P0       | `terminal_run` / `code_execute` default `shell=False` | Not implemented                                                                                                              |
| P1       | Runtime Unix socket `chmod 600` + handshake token     | Not implemented                                                                                                              |
| P1       | `FREEANIMA_WRITE_SAFE_ROOT` / `READ_SAFE_ROOT`        | Not implemented                                                                                                              |
| P2       | HTTP API auth                                         | 非 loopback Host 或 TCP 对端非 loopback 时须 `remote_auth` 或 401；双 loopback 免验 ([`remote-access.md`](remote-access.md)) |
| P3       | IPC / LLM rate limiting                               | None                                                                                                                         |
| P3       | Session disk encryption                               | None                                                                                                                         |

## Threat Sources

| Code  | Name                | Description                                                      |
| ----- | ------------------- | ---------------------------------------------------------------- |
| **A** | External attack     | Unauthorized access, port exposure                               |
| **B** | LLM-layer injection | Prompt injection, tool parameter manipulation, command injection |
| **C** | Agent error         | Mistaken dangerous operations                                    |
| **D** | Dependency chain    | Third-party lib / MCP / ACP compromise                           |
| **E** | Data security       | Conversation leak, key leak, memory tampering                    |

## Security Matrix

| Module           | A External                                      | B LLM injection                                                     | C Agent error             | D Dependencies     | E Data                             |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------- | ------------------------- | ------------------ | ---------------------------------- |
| **Runtime**      | Default 127.0.0.1 bind                          | MaxTurnsExceeded                                                    | Gap: rate limiting        | llm client vulns   | PG unencrypted                     |
| **Gateway**      | Token in pass                                   | Malicious messages                                                  | Reply with sensitive info | SDK vulns          | —                                  |
| **CLI / Tools**  | Local shell compromised                         | file_read_file partial deny (**P0 extending**); shell=True (**P0**) | rm -rf etc.               | —                  | Logs may contain conversations     |
| **HTTP / WebUI** | No auth by default; tunnel mode uses Access JWT | BFF does not touch LLM params directly                              | config display            | Vue/axios          | SSE plaintext                      |
| **MCP / ACP**    | SSE auth undefined                              | Malicious params                                                    | Wrong delegation          | Server compromised | Context may contain sensitive data |

## Proposals Pending Review

### P0 — file_read_file Path Safety

- Read-side deny: `/etc/`, `/proc/`, `~/.ssh/`, etc.
- Optional `FREEANIMA_READ_SAFE_ROOT`

### P0 — Shell Execution Policy

- `terminal_run()` / `code_execute` default `shell=False`
- `FREEANIMA_ALLOW_SHELL=true` required for shell pipes

### P1 — Runtime / Gateway

- Unix socket `chmod 600` + optional handshake token
- Write safe root default cwd (`FREEANIMA_WRITE_SAFE_ROOT`)

### P2 — Config Redaction Maintenance

- When adding secret fields, sync [`service/config/src/config-sanitize.ts`](../../service/config/src/config-sanitize.ts)

## First-Deployment Security Checklist

1. Install and initialize pass + GPG; all secrets into pass only
2. Copy [`config.example.yaml`](../../config.example.yaml) → `~/.anima/config.yaml`; **do not** write plaintext secrets in config
3. `chmod 700 ~/.anima`
4. Bind `127.0.0.1` only, or ensure intranet isolation
5. Review `mcp_servers` / `acp_agents` config; set `enabled: false` for untrusted external Servers
6. Regularly backup pass and `~/.anima/`; encrypt backup media
7. Do not commit `.env`, `config.yaml` to git
