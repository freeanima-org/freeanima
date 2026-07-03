---
title: Security
---

# FreeAnima Security

> Adopted principles: [architecture.md](../concepts/architecture.md).
> Security review and implementation items: [GitHub Issue #33](https://github.com/freeanima-org/freeanima/issues/33), [#46](https://github.com/freeanima-org/freeanima/issues/46).

## Trust Model (Required Reading for Open-Source Deployment)

FreeAnima is designed for **single-user local / intranet** deployment:

- Business HTTP API (`/api/*` except health/CORS/echo) requires a **Service API Token** (`Authorization: Bearer fa_at_…`); create with `anima token create`. Binding `127.0.0.1` limits network exposure but does not replace token auth — any local process that can reach the port still needs a valid token for business routes.
- Default bind is `127.0.0.1`; for LAN access, assess CORS and network isolation yourself.
- **Do not** expose the service to the public internet without TLS and token-protected clients (see [`remote-access.md`](remote-access.md)).

## Credential Responsibilities

| Rule                     | Description                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sole authoritative store | **Vault** (ECS `vault_item` in User + Agent libraries); legacy pass (`~/.password-store`) is read-only on disk after migration — runtime no longer uses pass CLI |
| Never commit secrets     | Do not write API keys, tokens, DB passwords into `config.yaml` and commit to git                                                                                 |
| Runtime directory        | `~/.anima/` (`FREEANIMA_HOME` overridable) holds config, agent machine key (`vault/agent-machine.key`), conversations, memory—recommend `chmod 700`              |
| CLI plaintext output     | `anima vault get` prints Agent-library field plaintext to stdout; do not redirect to shared logs                                                                 |
| User master password     | Set only in Shell `/vault` or bundled Chat unlock box; **never** sent as a chat message or stored in PG messages                                                 |
| Chat User vault unlock   | **v1 bundled Chat only** (`app/web` / desktop / mobile); Discord / WeChat gateways cannot unlock User library                                                    |

`config.yaml` supports `vault("item_id", "field")` (Agent library, Hub headless) and `env("KEY")` for secrets; values are injected at runtime. User-library inject for tools requires an unlocked Chat session on the client.

### Vault trust boundaries

| Surface | User library                | Agent library                         |
| ------- | --------------------------- | ------------------------------------- |
| Hub PG  | Ciphertext + verifier only  | Ciphertext + machine key file on disk |
| LLM     | Metadata / inject ack only  | Metadata / inject ack only            |
| Shell   | Client master key in memory | Hub decrypt over loopback SAP         |

## Data Persistence

| Path                               | Content                  | Encryption                      |
| ---------------------------------- | ------------------------ | ------------------------------- |
| PostgreSQL conversation archive    | conversations / messages | No application-layer encryption |
| `~/.anima/vault/agent-machine.key` | Agent vault machine key  | File permissions (`chmod 600`)  |
| `~/.anima/weixin/`                 | WeChat sync state        | None                            |

Disk backup = data access. Protect backup media accordingly.

## LLM Tool Risks

| Capability                    | Risk                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `terminal`                    | Default `shell: true`, can run arbitrary shell commands                                                                       |
| `file_read_file`              | Partial path deny (`.ssh` private keys, `/etc/passwd`, etc.); **not** full `/etc/` deny                                       |
| `file_write_file`             | deny list + write-protected paths                                                                                             |
| MCP tools                     | Capabilities entirely determined by external Server; stdio default, SSE auth scheme not fully defined                         |
| Capability mask (Mask)        | Conversation-level tool whitelist; `deny` overrides `allow`; LLM cannot see policy details; see `capabilities/task/src/mask/` |
| ACP (Cursor)                  | Default **auto-approve** all `session/request_permission` (`allow-once`)                                                      |
| `vault_list` / `vault_search` | Agent vault metadata only; no secret values                                                                                   |
| `vault_inject_env`            | Injects runtime env for subprocesses; tool result is ack only; User library requires Chat unlock                              |

## Measures in Place

| Measure                 | Description                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Same-origin RPC         | TanStack Start server functions same-origin by default, no CORS whitelist needed                                                       |
| Config secret redaction | `AppRuntime.getConfig()` → `sanitizeConfigForApi()` (`api_key`, `database.url`, nested `pushkey`, `mcp env`, etc.)                     |
| MCP config redaction    | `sanitizeMcpConfig`: `env` exposes only `env_keys`                                                                                     |
| Write path safety       | `file_write_file` deny list (partial `/etc/*`, `.ssh` private keys, etc.)                                                              |
| Slash commands          | Whitelist routing; every command must produce user-visible feedback; long-running commands send an immediate ack then the final result |
| MCP default stdio       | Reduces port exposure                                                                                                                  |
| Vault isolation         | LLM sees vault item metadata only, not decrypted fields                                                                                |
| Service API Token       | Business `/api/*` routes require `Authorization: Bearer fa_at_…` (`service_api_tokens` PG table); health/CORS/echo exempt              |
| CI secret scanning      | `.github/workflows/security.yml` (Gitleaks); GitHub Secret scanning + Push protection (free for public repos)                          |
| `.gitignore`            | `.env.*`, `config.yaml`, private key suffixes                                                                                          |

## Known Gaps (Documentation ≠ Fully Implemented)

The following are planned in code or docs—**deployers must not assume implemented**:

| Priority | Item                                                  | Status                              |
| -------- | ----------------------------------------------------- | ----------------------------------- |
| P0       | file_read_file full deny (`/etc/` etc.)               | Partial                             |
| P0       | `terminal_run` / `code_execute` default `shell=False` | Not implemented                     |
| P1       | Runtime Unix socket `chmod 600` + handshake token     | Not implemented                     |
| P1       | `FREEANIMA_WRITE_SAFE_ROOT` / `READ_SAFE_ROOT`        | Not implemented                     |
| P2       | Config redaction maintenance for new secret fields    | Partial — sync on new config fields |
| P3       | IPC / LLM rate limiting                               | None                                |
| P3       | Session disk encryption                               | None                                |

## Threat Sources

| Code  | Name                | Description                                                      |
| ----- | ------------------- | ---------------------------------------------------------------- |
| **A** | External attack     | Unauthorized access, port exposure                               |
| **B** | LLM-layer injection | Prompt injection, tool parameter manipulation, command injection |
| **C** | Agent error         | Mistaken dangerous operations                                    |
| **D** | Dependency chain    | Third-party lib / MCP / ACP compromise                           |
| **E** | Data security       | Conversation leak, key leak, memory tampering                    |

## Security Matrix

| Module             | A External                                                 | B LLM injection                                                     | C Agent error             | D Dependencies     | E Data                             |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------- | ------------------ | ---------------------------------- |
| **Runtime**        | Default 127.0.0.1 bind                                     | MaxTurnsExceeded                                                    | Gap: rate limiting        | llm client vulns   | PG unencrypted                     |
| **Gateway**        | Token in Vault / env                                       | Malicious messages                                                  | Reply with sensitive info | SDK vulns          | —                                  |
| **CLI / Tools**    | Local shell compromised                                    | file_read_file partial deny (**P0 extending**); shell=True (**P0**) | rm -rf etc.               | —                  | Logs may contain conversations     |
| **HTTP / Console** | `service_api_tokens` Bearer token（所有来源，含 loopback） | BFF does not touch LLM params directly                              | config display            | Vue/axios          | SSE plaintext                      |
| **MCP / ACP**      | SSE auth undefined                                         | Malicious params                                                    | Wrong delegation          | Server compromised | Context may contain sensitive data |
| **Vault**          | Agent machine key file permissions                         | Metadata-only tools; inject ack                                     | Wrong item inject         | Web Crypto         | User MP never in PG messages       |

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

- When adding secret fields, sync config sanitization in platform

## First-Deployment Security Checklist

1. Copy [`config.example.yaml`](../../config.example.yaml) → `~/.anima/config.yaml`; use `vault()` / `env()` — **do not** write plaintext secrets in config
2. Open Shell `/vault`; set User master password; migrate secrets from legacy pass if needed
3. `chmod 700 ~/.anima` (includes `vault/agent-machine.key`)
4. Bind `127.0.0.1` only, or ensure intranet isolation
5. Review `mcp_servers` / `acp_agents` config; set `enabled: false` for untrusted external Servers
6. Regularly backup `~/.anima/` (and legacy `~/.password-store` if kept); encrypt backup media
7. Do not commit `.env`, `config.yaml` to git
