# Testing rules

## Test tiers (mandatory)

| Tier                          | Location                                                                | Allowed                                                  | Forbidden                                                                               |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Unit**                      | `{layer}/{pkg}/src/**/*.test.ts` (**colocated**)                        | `mock` / `spyOn` / same-package Tier 1–2 exports (below) | PG, real Redis, file I/O, `FREEANIMA_HOME` isolation, `tests/helpers/`, Docker, network |
| **Cross-package integration** | `tests/integration/`                                                    | PG, Redis, temp dirs, `beginIntegrationCase`             | —                                                                                       |
| **Black-box E2E**             | [freeanima-testing](https://github.com/freeanima-org/freeanima-testing) | Compose + Playwright; PR dispatch async                  | —                                                                                       |

- pre-commit: `bun run test:changed` (**unit only**, changed)
- Before PR push: `bun run test` (unit + integration; black-box in freeanima-testing)
- Single-package logic → colocated unit tests; multi-package or real persistence → `tests/integration/`
- New features need tests (minimal viable); mock external deps; real LLM / network excluded from CI by default

## Same-package mock exports (prefer in unit tests)

| Tier                       | Packages                                                                                                                                  | Usage                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Tier 1 in-memory adapters  | `kernel-logging/null`, `/memory`, `/testing`; `kernel-eventbus/memory`, `/null`, `/testing`; `kernel-hooks/testing`; `storage-repos/null` | `createNullSink`, `createTestLogger`, `createTestEventBus`, `createTestHookRegistry`, `MemoryEventQueue`, `nullPgRepositories` |
| Tier 2 singleton injection | `connectors-redis`, `connectors-db-pg`, etc.                                                                                              | `setXForTest` / `resetXForTest`; `afterEach` must reset                                                                        |
| Tier 3 composite factories | optional `@freeanima/{pkg}/testing`                                                                                                       | Tier 1 only, e.g. `createTestLogger`                                                                                           |
| Domain mocks               | `{pkg}/src/test-helpers/`                                                                                                                 | when package has no port (e.g. `MockBackend`)                                                                                  |

Unit tests **must not** `import` `tests/helpers/log-isolation.ts` or write `config.yaml`; inject `Config.fromSnapshot()` (or bind package-specific config) and use `createNullSink` / `createMemorySink` for logging.

## Integration isolation

Use `tests/helpers/integration-case.ts` (`restoreIntegrationHome` + `flushCompressionSummaries`); do not pollute `~/.anima/error.log`.

Layout and CI wiring: [`tests/README.md`](../../tests/README.md).
