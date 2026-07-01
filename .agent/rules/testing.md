# Testing rules

## Test tiers (mandatory)

| Tier                          | Location                                                                | Allowed                                                  | Forbidden                                                                               |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Unit**                      | `{layer}/{pkg}/src/**/*.test.ts` (**colocated**)                        | `mock` / `spyOn` / same-package Tier 1–2 exports (below) | PG, real Redis, file I/O, `FREEANIMA_HOME` isolation, `tests/helpers/`, Docker, network |
| **Cross-package integration** | `tests/integration/`                                                    | PG, Redis, temp dirs, `beginIntegrationCase`             | —                                                                                       |
| **Black-box E2E**             | [freeanima-testing](https://github.com/freeanima-org/freeanima-testing) | Compose + Playwright; PR dispatch async                  | —                                                                                       |

- pre-commit: `bun run test:changed` (**unit only**, changed)
- Before PR push: `bun run test` (unit + integration; black-box in freeanima-testing)
- Before PR push: `bun run check` includes `stylelint`（手写 CSS 主题色规范，见 [frontend-ui.md](frontend-ui.md)）
- Single-package logic → colocated unit tests; multi-package or real persistence → `tests/integration/`
- New features need tests (minimal viable); mock external deps; real LLM / network excluded from CI by default

## Same-package mock exports (prefer in unit tests)

| Tier                       | Packages                                                                                                                         | Usage                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Tier 1 in-memory adapters  | `@freeanima/kernel/logging/null`、`/memory`、`/testing`；`@freeanima/kernel/eventbus/testing`；`@freeanima/kernel/hooks/testing` | `createNullSink`, `createTestLogger`, `createTestEventBus`, `createTestHookRegistry`                          |
| Tier 2 singleton injection | `@freeanima/platform/connectors/redis`；`@freeanima/core/db/pg`（`setDbForTest`）                                                | `setXForTest` / `resetXForTest`; `afterEach` must reset；PG 域函数用 `mock.module("@freeanima/core/db/pg/…")` |
| Tier 3 composite factories | optional `@freeanima/{pkg}/testing`                                                                                              | Tier 1 only, e.g. `createTestLogger`                                                                          |
| Domain mocks               | `{pkg}/src/test-helpers/`                                                                                                        | when package has no port (e.g. `MockBackend`)                                                                 |

Unit tests **must not** `import` `tests/helpers/log-isolation.ts` or write `config.yaml`; inject `Config.fromSnapshot()` (or bind package-specific config) and use `createNullSink` / `createMemorySink` for logging.

## Temp directory cleanup

- Prefer `@freeanima/core/util` helpers: `createTempDir(prefix)` + `removeTempDir(path)` (or `removeManagedAnimaTmpPath` for `anima-cwd-*` / `anima-exec-*`).
- Any `mkdtemp` / `createTempDir` in unit tests **must** pair with `afterEach` / `afterAll` / `try/finally` cleanup via `removeTempDir`.
- Integration tests **must** use `beginIntegrationCase` + `restoreIntegrationHome`; do not call `beginLogIsolation` alone without teardown. `restoreIntegrationHome` deletes the temp `FREEANIMA_HOME` and conversation `anima-cwd-*` dirs under `/tmp`.

## Integration isolation

Use `tests/helpers/integration-case.ts` (`restoreIntegrationHome` + `flushCompressionSummaries`); do not pollute `~/.anima/error.log`.

Layout and CI wiring: [`tests/README.md`](../../tests/README.md).
