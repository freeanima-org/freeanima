---
title: Execute Code Runtimes
---

# execute_code Multi-Runtime

> One tool, multiple runtimes; default Bun; extend with Python / Deno as needed.

## Background

`execute_code` runs short scripts in a controlled subprocess. The LLM must know which language to write and which runtime to pick — otherwise Python sent to Node fails.

## Division from terminal

|           | `execute_code`                               | `terminal`                              |
| --------- | -------------------------------------------- | --------------------------------------- |
| Execution | No shell, fixed runtime                      | shell=true                              |
| Best for  | Short scripts, data processing, logic checks | System commands, pipes, git, long tasks |
| Output    | 50KB cap, configurable timeout               | Same limits but more freedom            |
| Security  | Smaller surface (no shell injection)         | Larger surface                          |

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

## Credential Injection (Planned)

Architecture allows credential path injection in `execute_code` environments — **not yet implemented**. See [Issue #40](https://github.com/freeanima-org/freeanima/issues/40).

Credential values are never exposed to the LLM; injected from pass at runtime — no pass CLI inside runtimes.
