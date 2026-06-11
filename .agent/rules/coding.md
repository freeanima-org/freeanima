# Coding standards

## TypeScript

- Full type annotations on new and touched code
- **Relative imports must include `.ts` / `.tsx` suffix** (oxlint `import/extensions`)

## Tool returns

- **Failures**: always `toolError(msg)` → JSON `{"error":"..."}`
- **Successes**: structured tools use `toolResult(obj)`; LLM-readable tools (`file_read_file`, `terminal_run`, `code_execute`, etc.) may return plain-text stdout
- Safe paths per existing code (write protection, device blocking, binary filtering)

## Type ownership

When adding or moving types / Zod / ports, decide in this order:

1. **PG storage shape (DDL + JSONB Zod)** → `@freeanima/engine-db` (sole SSOT) — [`engine/db/src/schema/`](../../engine/db/src/schema/)
2. **Repository ports and aggregates** → `@freeanima/engine-repos` (`*StorePort`, `PgRepositories`; includes `null*` adapters) — [`engine/repos/src/ports/`](../../engine/repos/src/ports/)
3. **Domain types** → owner package (`{layer}-{slug}`); hoist to kernel pure-type packages only when shared across domains

Additional rules:

- Domain views may `import type` / `z.infer` from `engine-db`, but **must not duplicate** storage Zod definitions
- **HTTP/WebUI contracts** → `connectors-webui/api` or `service-api`; **in-process snapshots/display** → `service`
- **EventBus payloads** → publisher's domain package (e.g. memory events → `life-memory`)

Do not maintain a domain-to-package inventory in docs — use source and `grep`.

## Security and continuity

- Credentials and secrets never in git / logs / tool return values
- Memory and self-layer changes need extra care — [`docs/concepts/identity.md`](../../docs/concepts/identity.md)
- Continuity over feature pile-up; simple infra in-house, complex logic via mature third-party libs

## Release

- **Do not manually edit [`CHANGELOG.md`](../../CHANGELOG.md)** — Release Please only
- Commit conventions: [`docs/guide/versioning.md`](../../docs/guide/versioning.md)
