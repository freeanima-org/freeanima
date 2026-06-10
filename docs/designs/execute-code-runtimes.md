---
title: Execute Code Runtimes
---

# execute_code Multi-Runtime Design

> One tool, multiple runtimes; default Node.js, extend Python / Deno on demand.

## Background

`execute_code` was hardcoded to Node.js, but the tool schema exposed only `"Run code"` to the LLM, causing models to frequently write Python and fail execution.

Goals:

1. **Clear semantics** — LLM knows which language to write and which runtime to pick
2. **Default Bun** — same stack as FreeAnima, preferred for TS/JS snippets
3. **Extensible** — reserve Python, Deno, enable progressively via config
4. **Division from terminal** — structured subprocess vs shell

## Division from terminal

|           | `execute_code`                               | `terminal`                              |
| --------- | -------------------------------------------- | --------------------------------------- |
| Execution | No shell, fixed runtime                      | shell=true                              |
| Best for  | Short scripts, data processing, logic checks | System commands, pipes, git, long tasks |
| Output    | 50KB cap, controllable timeout               | Same limits but more freedom            |
| Security  | Smaller attack surface (no shell injection)  | Larger attack surface                   |

Python batch jobs should use `execute_code(runtime="python")`, not `python3 -c "..."` in terminal.

## API

```typescript
execute_code({
  code: string,           // source
  runtime?: "bun" | "nodejs" | "python" | "deno",  // default bun
  timeout?: number,       // seconds, default 300, max 600
})
```

### LLM-Visible Description (Principles)

- Top-level `description` is LLM's sole source of truth (flat JSON Schema, no nested wrapper)
- State default runtime, each runtime's language, alternatives when runtime disabled

## Runtime Registry

```typescript
interface CodeRuntime {
  id: "nodejs" | "python" | "deno";
  enabled: boolean;
  extension: string; // .mts / .py / .ts
  preamble?: string; // bootstrap before writing file
  command: string[]; // spawn command and args (last item is file path placeholder)
}
```

| runtime    | command                           | file   | preamble                      | status         |
| ---------- | --------------------------------- | ------ | ----------------------------- | -------------- |
| **bun**    | `bun` (`Bun.spawn`)               | `.ts`  | common `node:fs` imports etc. | ✅ implemented |
| **nodejs** | `node --experimental-strip-types` | `.mts` | common `node:fs` imports etc. | ✅ implemented |
| **python** | `python3`                         | `.py`  | optional `os`/`pathlib`       | 🔲 reserved    |
| **deno**   | `deno run --allow-read=...`       | `.ts`  | Deno stdlib                   | 🔲 reserved    |

### Phase Plan

| Phase            | Content                                               | Status                                                          |
| ---------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| **P0** (current) | Flat schema + `runtime` param + bun/nodejs enabled    | ✅ implemented                                                  |
| **P1–P4**        | python / config toggles / deno / credential injection | see [#40](https://github.com/freeanima-org/freeanima/issues/40) |

## Configuration (P2 Reserved)

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
      command: deno
```

Disabled runtime returns:

```json
{ "error": "runtime 'python' not enabled; available: nodejs" }
```

## Execution Flow

```
LLM calls execute_code(code, runtime?)
        │
        ▼
  Resolve runtime (default nodejs)
        │
        ▼
  Lookup registry → enabled?
        │ no ──→ {"error": "..."}
        ▼ yes
  mkdtemp → write preamble + code → spawn
        │
        ▼
  Merge stdout/stderr; non-zero exit → JSON { output, exit_code }
        │
        ▼
  Clean temp files
```

## Security

- Always `shell: false` (consistent with `docs/security.md`)
- Timeout and `maxBuffer` same as current implementation
- Before enabling Deno, define `--allow-*` whitelist policy
- **Do not** auto-guess runtime from code content (avoid misjudgment)

## Credential Injection (P4, Issue #40)

ARCHITECTURE specifies `credential(path)` available in `execute_code` execution environment, **not yet implemented**.

Suggested unified multi-runtime approach:

1. Parent process resolves `credential("...")` calls in code before spawn (or explicit params)
2. Inject via environment: `ANIMA_CRED_<PATH>` (path escaped)
3. Each runtime preamble provides same-name helper reading env

Do not call pass CLI inside each runtime.

## Tool Schema Flattening

FreeAnima local tools use standard OpenAI shape:

```typescript
registerTool({
  name: "execute_code",
  description: "……full description LLM sees……",
  parameters: {
    type: "object",
    properties: { … },
    required: […],
  },
  handler: …,
});
```

Forbidden: nested `{ name, description, parameters: { … } }` wrapper; `openaiFunctionSchema` maps top-level fields directly.

## File Layout

```
capabilities/tools/src/
  execute-code.ts          # tool registration + routing
  execute-code-runtimes.ts # runtime registry and spawn logic (P1+ extension)
```

## Tests

- Default `runtime` nodejs executes TS/JS
- Disabled runtime returns error JSON
- `openaiSchemas()` `execute_code.description` includes Node.js note
- Nested parameters format regression: should not reappear
