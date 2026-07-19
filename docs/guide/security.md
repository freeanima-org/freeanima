---
title: Security
---

# FreeAnima Security

> Adopted principles: [architecture.md](../concepts/architecture.md).
> Security review and implementation items: [GitHub Issue #33](https://github.com/freeanima-org/freeanima/issues/33), [#46](https://github.com/freeanima-org/freeanima/issues/46).

## Trust Model (Required Reading for Open-Source Deployment)

FreeAnima is designed for **single-user local / intranet** deployment:

- Hub RPC REST (`/hub/rpc/v1/*` except health probe/CORS/echo) requires a **Service API Token** (`Authorization: Bearer fa_at_…`); create with `anima token create`. Binding `127.0.0.1` limits network exposure but does not replace token auth — any local process that can reach the port still needs a valid token for business routes.
- Default bind is `127.0.0.1`; for LAN access, assess CORS and network isolation yourself.
- **Do not** expose the service to the public internet without TLS and token-protected clients (see [`remote-access.md`](remote-access.md)).

## Credential Responsibilities

| Rule                     | Description                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sole authoritative store | **Vault** (ECS `vault_item` in User + Agent libraries); legacy pass (`~/.password-store`) is read-only on disk after migration — runtime no longer uses pass CLI     |
| Never commit secrets     | Do not write API keys, tokens, DB passwords into `config.yaml` and commit to git; runtime LLM/MCP settings live in PG — use `vault()` / `env()` references there too |
| Runtime directory        | `~/.anima/` (`FREEANIMA_HOME` overridable) holds config, agent machine key (`vault/agent-machine.key`), conversations, memory—recommend `chmod 700`                  |
| CLI plaintext output     | `anima vault get` prints Agent-library field plaintext to stdout; do not redirect to shared logs                                                                     |
| User master password     | Set only in Shell `/vault` or bundled Chat unlock box; **never** sent as a chat message or stored in PG messages                                                     |
| Chat User vault unlock   | **v1 bundled Chat only** (`src/app/shell/web` / desktop / mobile); Discord / WeChat gateways cannot unlock User library                                              |

`config.yaml` supports `vault("item_id", "field")` (Agent library, Hub headless) and `env("KEY")` for secrets; values are injected at runtime. Agent tools that need CLI credentials pass per-call `secrets[]` on `terminal_run` / `code_execute` (child env only). User-library resolution still requires an unlocked Chat session on the client.

### Vault trust boundaries

| Surface | User library                          | Agent library                         |
| ------- | ------------------------------------- | ------------------------------------- |
| Hub PG  | Ciphertext + verifier only            | Ciphertext + machine key file on disk |
| LLM     | Metadata only; subprocess `secrets[]` | Metadata only; subprocess `secrets[]` |
| Shell   | Client master key in memory           | Hub decrypt over loopback SAP         |

## Data Persistence

| Path                               | Content                  | Encryption                      |
| ---------------------------------- | ------------------------ | ------------------------------- |
| PostgreSQL conversation archive    | conversations / messages | No application-layer encryption |
| `~/.anima/vault/agent-machine.key` | Agent vault machine key  | File permissions (`chmod 600`)  |
| `~/.anima/weixin/`                 | WeChat sync state        | None                            |

Disk backup = data access. Protect backup media accordingly.

## LLM Tool Risks

| Capability                                                 | Risk                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terminal_run`                                             | Default `shell: false` (argv spawn). `shell: true` requires `FREEANIMA_ALLOW_SHELL=true`. Optional `secrets[]` decrypts Vault into **that subprocess env only** (not Hub `process.env`). Always-on hard deny for catastrophic targets—**not** an OS sandbox; bypass via `code_execute` / interpreters remains |
| `file_read` / `file_write` / `file_delete` / `file_search` | Path deny: `/etc`, `/proc`, `/sys`, dangerous `/dev`, `~/.ssh` private keys, `FREEANIMA_HOME/vault`. Heuristic deny ≠ writable-root sandbox                                                                                                                                                                   |
| `code_execute`                                             | No shell (Bun/Node argv). Optional `secrets[]` same as `terminal_run`. Arbitrary JS can still use `node:fs`—not a container sandbox                                                                                                                                                                           |
| MCP tools                                                  | Capabilities entirely determined by external Server; stdio default, SSE auth scheme not fully defined                                                                                                                                                                                                         |
| Capability mask (Mask)                                     | Conversation-level tool whitelist; `deny` overrides `allow`; LLM cannot see policy details; see `src/features/task/domain/mask/`                                                                                                                                                                              |
| ACP (Cursor)                                               | Default **auto-approve** all `session/request_permission` (`allow-once`)                                                                                                                                                                                                                                      |
| `vault_list` / `vault_search` / `vault_get_meta`           | Vault metadata only; no secret values (MCP-exposed)                                                                                                                                                                                                                                                           |
| `vault_create` / `vault_update` / `vault_delete`           | Habitat-only (not MCP). create/update seal plaintext into **Agent** library only; tool results are metadata only. User library writes stay in Vault UI                                                                                                                                                        |

### Agent vault usage

1. **Discover** — `vault_list` / `vault_search` / `vault_get_meta` (metadata only; never plaintext in tool results).
2. **Write (Agent library)** — `vault_create` / `vault_update` / `vault_delete` in Habitat chat only (not MCP). create/update accept plaintext `secrets` to seal on Hub; results return metadata only. User library: Vault UI.
3. **Use** — pass `secrets: [{ id, env_name, field?, subject_kind? }]` on the same `terminal_run` or `code_execute` call that needs the credential (e.g. `GH_TOKEN` for `gh`).
4. **Scope** — plaintext is decrypted for that spawn only and merged into the child `env`; it is **not** written to Hub `process.env`. Default `shell=false`: use argv form (`printenv GH_TOKEN`, `gh …`), not `echo $VAR`.

## Measures in Place

| Measure                    | Description                                                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-origin RPC            | TanStack Start server functions same-origin by default, no CORS whitelist needed                                                                                                    |
| Config API secrets         | Console/Hub config GET returns secrets in cleartext (`api_key`, etc.); MCP `env` still becomes `env_keys` only. Legacy `"***"` on write-back is restored via `restoreMaskedSecrets` |
| MCP config redaction       | `sanitizeConfigForApi`: MCP `env` → `env_keys` only                                                                                                                                 |
| File path policy           | Shared `path-policy` for `file_*` tools: `/etc`, vault, ssh private keys, `/proc`/`/sys`, blocked devices                                                                           |
| Terminal shell default off | `terminal_run` default `shell=false`; pipes need `FREEANIMA_ALLOW_SHELL=true`                                                                                                       |
| Terminal command hard deny | Always-on catastrophic command policy (`terminal-command-policy`); cannot be disabled via env                                                                                       |
| Slash commands             | Whitelist routing; every command must produce user-visible feedback; long-running commands send an immediate ack then the final result                                              |
| MCP default stdio          | Reduces port exposure                                                                                                                                                               |
| Vault isolation            | LLM sees vault item metadata only, not decrypted fields                                                                                                                             |
| Service API Token          | Hub RPC REST `/hub/rpc/v1/*` routes require `Authorization: Bearer fa_at_…` (`service_api_tokens` PG table); health probe/CORS/echo exempt                                          |
| CI secret scanning         | `.github/workflows/security.yml` (Gitleaks); GitHub Secret scanning + Push protection (free for public repos)                                                                       |
| `.gitignore`               | `.env.*`, `config.yaml`, private key suffixes                                                                                                                                       |

## Known Gaps (Documentation ≠ Fully Implemented)

The following are planned in code or docs—**deployers must not assume implemented**:

| Priority | Item                                               | Status                                                        |
| -------- | -------------------------------------------------- | ------------------------------------------------------------- |
| P0       | `file_*` path deny (`/etc/`, vault, ssh, …)        | **Implemented** (`path-policy`)                               |
| P0       | `terminal_run` default `shell=false` + ALLOW_SHELL | **Implemented**                                               |
| P0       | Terminal catastrophic command hard deny            | **Implemented** (heuristic; ≠ sandbox)                        |
| P0       | `code_execute` no shell                            | **Implemented** (JS FS still open)                            |
| P1       | Runtime Unix socket `chmod 600` + handshake token  | Not implemented                                               |
| P1       | `FREEANIMA_WRITE_SAFE_ROOT` / `READ_SAFE_ROOT`     | Not implemented                                               |
| P2       | (retired) Config API field redaction maintenance   | Dropped — secrets not masked; MCP `env_keys` still maintained |
| P3       | IPC / LLM rate limiting                            | None                                                          |
| P3       | Session disk encryption                            | None                                                          |

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
| **CLI / Tools**    | Local shell compromised                                    | path deny + terminal hard deny (bypass via `code_execute` possible) | Reduced catastrophic rm   | —                  | Logs may contain conversations     |
| **HTTP / Console** | `service_api_tokens` Bearer token（所有来源，含 loopback） | BFF does not touch LLM params directly                              | config display            | Vue/axios          | SSE plaintext                      |
| **MCP / ACP**      | SSE auth undefined                                         | Malicious params                                                    | Wrong delegation          | Server compromised | Context may contain sensitive data |
| **Vault**          | Agent machine key file permissions                         | Metadata-only tools; per-call `secrets[]` on subprocess tools       | Wrong item / env_name     | Web Crypto         | User MP never in PG messages       |

## Proposals Pending Review

### P0 — File path safety (landed)

- Read/write/delete/search deny: `/etc/`, `/proc/`, `~/.ssh/` private keys, vault under `FREEANIMA_HOME`
- Optional `FREEANIMA_READ_SAFE_ROOT` still **P1**

### P0 — Shell execution + command hard deny (landed)

- `terminal_run` default `shell=false`; `FREEANIMA_ALLOW_SHELL=true` for shell pipes
- Always-on deny for catastrophic `rm`/`rmdir`, `mkfs*`, `dd of=/dev/…`, fork bombs, power commands, recursive chmod/chown on `/` or `$HOME`, destructive `find` on system/home roots
- `code_execute` remains argv-only (no shell); **not** a process sandbox

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
8. Keep `FREEANIMA_ALLOW_SHELL` unset unless you intentionally need shell pipes in `terminal_run`
