# Agent rules index

Detailed implementation constraints for AI agents working in this repository. Start with root [`AGENTS.md`](../../AGENTS.md), then open the files below as needed.

| File                               | When to read                                                   |
| ---------------------------------- | -------------------------------------------------------------- |
| [`coding.md`](coding.md)           | Editing any TypeScript; tool handlers; types / Zod / ports     |
| [`testing.md`](testing.md)         | Adding or moving tests; mock strategy; CI tiers                |
| [`packages.md`](packages.md)       | New workspace package or rename (RFC #1)                       |
| [`code-layers.md`](code-layers.md) | Layer deps, composition root, Registry injection, engine tiers |
| [`database.md`](database.md)       | PG schema, Drizzle migrations, new storage domain              |

**SSOT**: dependency boundaries → [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts); storage shapes → [`engine/db/src/schema/`](../../engine/db/src/schema/); ports → [`engine/repos/src/ports/`](../../engine/repos/src/ports/).

Product / cognitive architecture (four storage layers, tools, Gateway) → [`docs/concepts/architecture.md`](../../docs/concepts/architecture.md).
