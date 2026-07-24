# Testing rules

## Test tiers (mandatory)

| Tier                          | Location                                                                | Allowed                                                  | Forbidden                                                                               |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Unit**                      | `src/**/*.test.ts` (**colocated**)                                      | `mock` / `spyOn` / same-package Tier 1–2 exports (below) | PG, real Redis, file I/O, `FREEANIMA_HOME` isolation, `tests/helpers/`, Docker, network |
| **Cross-package integration** | `tests/integration/`                                                    | PG, Redis, temp dirs, `beginIntegrationCase`             | —                                                                                       |
| **Black-box E2E**             | [freeanima-testing](https://github.com/freeanima-org/freeanima-testing) | Compose + Playwright; PR dispatch async                  | —                                                                                       |

- pre-commit: `just qa pre-commit`（含 `just qa test-changed`，**unit only**）
- Before PR push: `just test` / `just qa test`（unit + integration；black-box in freeanima-testing）
- Before PR push: `just check` includes `stylelint`（手写 CSS 主题色规范，见 [frontend-ui.md](frontend-ui.md)）
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

- Prefer `@freeanima/core/util/temp-dir` helpers: `createTempDir(prefix)` + `removeTempDir(path)`（或 `removeManagedAnimaTmpPath`，用于 `anima-cwd-*` / `anima-exec-*`）。**勿**从 `@freeanima/core/util` 桶导入（桶不含 Node 专用 API，避免浏览器拉取 `node:path`）。
- Any `mkdtemp` / `createTempDir` in unit tests **must** pair with `afterEach` / `afterAll` / `try/finally` cleanup via `removeTempDir`.
- Integration tests **must** use `beginIntegrationCase` + `restoreIntegrationHome`; do not call `beginLogIsolation` alone without teardown. `restoreIntegrationHome` deletes the temp `FREEANIMA_HOME` and conversation `anima-cwd-*` dirs under `/tmp`.

## Integration isolation

Use `tests/helpers/integration-case.ts` (`restoreIntegrationHome` + `flushCompressionSummaries`); do not pollute `~/.anima/error.log`.

### PG：必须用隔离库（硬禁止指日常库）

`just qa test-integration` 起 Docker 临时 PG → 建迁移好的模板库 `anima_it_template` → 每个测试进程克隆 `anima_it_*` 独立库（**不再** `clearPgTables`）。`--parallel` 默认开启（`FREEANIMA_TEST_PARALLEL` 可覆盖）。子集：`just qa test-integration -- <paths>`。

| 允许                                                        | 禁止                                                                         |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `just qa test-integration`（Docker 随机高位端口）           | 把 `ANIMA_TEST_PG_URL` 指到与 `~/.anima/config.yaml` **同 host:port** 的实例 |
| `just qa test-integration -- tests/integration/…` 子集      | `bun test tests/integration/...` 复用 `just dev` / 日常库                    |
| 自起 Docker / 空实例（端口 ≠ 日常）再设 `ANIMA_TEST_PG_URL` | —                                                                            |

护栏：同 host:port 时 `describePg` **整包 skip**，且 `setupIntegrationPg` / `createIsolatedTestDb` **直接 throw**（零副作用）。

无 Docker 且未设隔离 URL 时：PG 用例 **skip**，**不要**改指日常库。

Layout and CI binding: [`tests/README.md`](../../tests/README.md).
