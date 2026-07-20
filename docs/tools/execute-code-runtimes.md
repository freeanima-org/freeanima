---
title: Execute Code Runtimes
---

# execute_code Multi-Runtime

> One tool, multiple runtimes; default Bun; extend with Python / Deno as needed.

## Background

`execute_code` runs short scripts in a controlled subprocess. The LLM must know which language to write and which runtime to pick — otherwise Python sent to Node fails.

## Division from terminal

|           | `execute_code`                               | `terminal`                                                               |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| Execution | No shell, fixed runtime                      | Default `shell=false` (argv); `shell=true` for pipes/redirection         |
| Best for  | Short scripts, data processing, logic checks | System commands, git, long tasks; pipes need `shell=true`                |
| Output    | 50KB cap, configurable timeout               | Same limits                                                              |
| Security  | No shell injection; **not** a FS sandbox     | Catastrophic command hard deny + workdir path policy; still ≠ OS sandbox |

Use `execute_code(runtime="python")` for Python batches, not `python3 -c "..."` in terminal.

## API

```typescript
execute_code({
  code: string,
  runtime?: "bun" | "nodejs" | "python" | "deno",  // default bun
  timeout?: number,       // seconds, default 300, max 600
})
```

## Available Runtimes

| runtime    | Language                | Status                  |
| ---------- | ----------------------- | ----------------------- |
| **bun**    | TypeScript / JavaScript | ✅ default              |
| **nodejs** | TypeScript / JavaScript | ✅ implemented          |
| **python** | Python                  | 🔲 reserved (Issue #40) |
| **deno**   | TypeScript              | 🔲 reserved (Issue #40) |

## Configuration (Reserved)

```yaml
execute_code:
  default_runtime: bun
  runtimes:
    nodejs:
      enabled: true
    python:
      enabled: true
      command: python3
    deno:
      enabled: false
```

Disabled runtimes return a clear error listing available runtimes.

## Security

- Always `shell: false` (see [`security.md`](../guide/security.md))
- Timeout and output size limits match current implementation
- **Do not** auto-guess runtime from code content
- JS runtimes can still import `node:fs`—terminal command hard denies do **not** apply inside `code_execute`

## Credential Injection

`code_execute` (and `terminal_run`) accept optional `secrets[]`: Vault item refs decrypted for **that subprocess only** and merged into child `env` (not Habitat `process.env`). Values never appear in LLM tool results. Prefer argv / `process.env.NAME` inside the snippet; no vault CLI inside runtimes.

File-path credential mounts (Issue #40 style) are **not** implemented; use `secrets[]` for CLI/runtime needs.
