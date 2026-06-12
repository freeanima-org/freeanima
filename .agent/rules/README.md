# Agent rules index

Detailed implementation constraints for AI agents working in this repository. Start with root [`AGENTS.md`](../../AGENTS.md), then open the files below as needed.

| File                               | When to read                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- |
| [`coding.md`](coding.md)           | Editing any TypeScript; tool handlers; types / Zod / ports; PG migrations |
| [`drizzle-db.md`](drizzle-db.md)   | `connectors/db-pg` repository queries; ORM vs `db.execute`; DbRow typing  |
| [`testing.md`](testing.md)         | Adding or moving tests; mock strategy; CI tiers                           |
| [`packages.md`](packages.md)       | New workspace package or rename (RFC #1)                                  |
| [`code-layers.md`](code-layers.md) | Eight-layer deps, composition root, Registry injection                    |
| [`release.md`](release.md)         | SemVer, Conventional Commits, Release Please, npm/Docker                  |
| [`compression.md`](compression.md) | l-point compression algorithm and module entry points                     |

**SSOT**: dependency boundaries → [`scripts/check-layer-deps.ts`](../../scripts/check-layer-deps.ts); storage shapes → [`storage/db/src/schema/`](../../storage/db/src/schema/); ports → [`storage/repos/src/ports/`](../../storage/repos/src/ports/).

Product / cognitive architecture (four storage layers, tools, Gateway) → [`docs/concepts/architecture.md`](../../docs/concepts/architecture.md).
