# Coding standards

## TypeScript

- Full type annotations on new and touched code
- **Relative imports must include `.ts` / `.tsx` suffix** (oxlint `import/extensions`)
- **Relative import depth**（`bun scripts/check-import-depth.ts`）：`src/`、`scripts/`、`tests/` 内相对路径最多 `../../`（禁止 `../../../` 及以上）；禁止 `../src/` 形式（跨目录引用 `src/` 须用 `@freeanima/*`）
- **Base compiler flags** ([`tsconfig.base.json`](../../tsconfig.base.json)): `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noImplicitOverride`, `allowUnreachableCode: false`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- **Paraglide types**: [`types/paraglide-messages.generated.d.ts`](../../types/paraglide-messages.generated.d.ts) is generated from `messages/en.json` (`bun scripts/gen-paraglide-message-types.ts`; optional via `just i18n check`)
- **Optional props**: with `exactOptionalPropertyTypes`, do not pass `prop: undefined` — use `omitUndefined()` from `@freeanima/host/core/util` or conditional spread

## Lint (oxlint)

- **Commands**: `just qa lint`（含 type-aware，`options.typeAware: true`）；`just qa lint-fix`；纳入 `just check`。
- **依赖**: `oxlint` + `oxlint-tsgolint`（type-aware 规则需 TS 语义）。
- **Config**: [`.oxlintrc.json`](../../.oxlintrc.json) — `correctness` 与 `suspicious` 为 error；type-aware 下显式启用的 `typescript/*` 见下。
- **Type-aware error 规则**（勿随意 disable）:
  - `typescript/no-floating-promises` — 未 await/void/return 的 Promise
  - `typescript/no-misused-promises` — async 误作 sync 回调（含 React 事件 handler）
  - `typescript/await-thenable` — await 非 Thenable
  - `typescript/no-explicit-any` — 显式 `any`（`**/*.{test,spec}.{ts,tsx}`、`tests/**`、`routeTree.gen.ts` 除外）
  - `typescript/no-non-null-assertion` — 禁止 `!.`（测试文件同上 override off）
- **Error-level 规则**（fix，do not disable without reason）:
  - `unicorn/no-array-sort` — use `Array#toSorted()` when returning a sorted copy; avoid in-place `.sort()` unless mutation is intentional (then use a line-level disable with reason).
  - `unicorn/prefer-add-event-listener` — prefer `addEventListener` over `on*` property handlers (DOM, WebSocket, IDB, SharedWorker).
  - `unicorn/prefer-node-protocol` — Node 内置模块用 `node:` 前缀。
  - `unicorn/no-useless-spread` — avoid `[...iterable]` when the callee already accepts iterables.
  - `unicorn/consistent-function-scoping` — hoist inner functions that do not close over locals (off in `*.test.ts` / `tests/**`).
  - `eslint/no-useless-constructor` — remove empty/redundant constructors (line-level disable only for documented tooling quirks, e.g. Bun coverage).
  - `eslint/no-unmodified-loop-condition` — loop flags mutated outside the loop body should use `while (true)` + early `break`.
  - `import/no-unassigned-import` — side-effect imports (CSS, global augmentation) need assignment, `import type {}`, or a one-line disable with reason.
  - `eslint/no-underscore-dangle` — allowed: `allowAfterThis`, plus named globals in config (`__freeanimaShellBridge`, `_exhaustive`, Zod `_def`, etc.).
  - `eslint/eqeqeq` — always `===` / `!==` (`null` checks may use `== null` / `!= null`).
  - `eslint/no-promise-executor-return` — Promise executor must not return a value; use block body (`{ setTimeout(resolve, ms); }`).
  - `unicorn/explicit-length-check` — use `.length > 0` / `.length === 0`, not truthy `.length`.
- **React**（feature-habitat / ui-kit / companion override）: `react/rules-of-hooks` error；`react/exhaustive-deps` warn。
- **Disable 纪律**（oxlint + review 把关）:
  - `oxlint-disable` / `eslint-disable` 行须含 `-- reason`
  - 禁止 `ts-ignore` / `ts-nocheck`；`ts-expect-error` 须同行说明
  - 契约目录（`src/host/platform/ports/`、`habitat-contract/`、`rpc-contract/`）禁止显式 `any`（`oxlint` `no-explicit-any`）

- **Failures**: always `toolError(msg)` → JSON `{"error":"..."}`
- **Successes**: structured tools use `toolResult(obj)`; LLM-readable tools (`file_read`, `terminal_run`, `code_execute`, etc.) may return plain-text stdout
- **Tool 入参**: call 前须经 `validateToolArgs`（对照 `ToolDef.parameters`）；类型错误与未知字段一律 `toolError`，禁止静默忽略/strip。loop-engine 与 MCP / Habitat 不得绕过该门闸直接调 `handler`
- Safe paths per existing code (write protection, device blocking, binary filtering)

## ToolSet / tool naming

**Pluralization (layered — do not mix):**

| Layer                              | Singular              | Plural              | Example                                            |
| ---------------------------------- | --------------------- | ------------------- | -------------------------------------------------- |
| ToolSet registry id                | yes                   | no                  | `file`, `memory`, `toolset`, `session`             |
| Tool `function.name` first segment | yes (= ToolSet id)    | no                  | `file_read`, `conversation_search`, `toolset_load` |
| Action segment                     | verb / singular sense | no                  | `_read`, `_search` (not `_reads`)                  |
| Meta fields holding id lists       | no                    | yes                 | `cached_toolsets`, `staged_toolsets`               |
| TS types                           | `ToolSet`             | property `toolSets` | unrelated to id strings                            |

**Multi-segment tool names:** `_` is standard (`mcp_{server}_{local}`, `acp_{agent}_{action}`, `remote_{app}_{instance}_{local}`). `.` / `:` aliases for remote tools. `-` only in ToolSet ids (e.g. `fridge-magnet`), not in tool names. `/` forbidden.

**Module files:** one ToolSet per register module — `src/host/capabilities/**/src/{toolset-id}.ts` matching `registerToolSet("…")` (composite ids: `memory_semantic` → `memory-semantic.ts`). Plural filenames allowed only for multi-id config (`default-conversation-toolsets.ts`).

## Type ownership

When adding or moving types / Zod / ports, decide in this order:

1. **PG storage shape (DDL + JSONB Zod)** → `@freeanima/host/core/db` (sole SSOT) — [`src/host/core/db/schema/`](../../src/host/core/db/schema/)
2. **PG 查询 API** → `@freeanima/host/core/db/pg/{domain}`（函数 + `types.ts`）；memory citation marker → `@freeanima/host/core/db/pg/memory-reference/markers` — [`src/host/core/db/pg/`](../../src/host/core/db/pg/)
3. **Domain types** → owner package (`{layer}-{slug}` or `@freeanima/host/core/*` subpath); hoist to kernel pure-type packages only when shared across domains

Additional rules:

- Domain views may `import type` / `z.infer` from `@freeanima/host/core/db`, but **must not duplicate** storage Zod definitions
- **HTTP/Habitat protocol 契约** → `@freeanima/habitat-contract`（类型 + `date-json` / `display-util`）；**Habitat REST 实现** → `@freeanima/habitat-api`；**in-process snapshots/display** → `@freeanima/platform`
- **EventBus payloads** → publisher's domain package (e.g. memory events → `capabilities-memory`)
- **Repository row shapes** → [`src/host/core/db/schema/rows/`](../../src/host/core/db/schema/rows/) = `typeof table.$inferSelect`；domain `types.ts` re-export；1:1 CRUD **无 mapper**（非平凡 join/transform 见 [`drizzle-db.md`](drizzle-db.md)）

Do not maintain a domain-to-package inventory in docs — use source and `grep`.

## 全栈 snake_case（PG / repos / protocol）

- **Drizzle TS 属性名 = PG 列名 = snake_case**（例：`block_key: text("block_key")`）；禁止 `blockKey: text("block_key")`
- **Port 方法名**（`searchFts`、`appendMessageReturningId` 等）与 **tool/REST 计算字段** 保持 camelCase
- **Row 数据字段** 一律 snake_case；时间戳列统一 `created_at` / `updated_at`（以 [`src/host/core/db/schema/`](../../src/host/core/db/schema/) 为准）
- **PG row 类型**：`src/host/core/db/schema/rows/*` 或 `typeof table.$inferSelect`；JSON 边界 `Date`↔ISO（见 drizzle-db）；禁止 camelCase→snake_case 字段改名表与 dual-key DbRow
- **Remote tools / feature protocol**：capabilities 从 `@freeanima/rpc-contract` re-export Payload；Habitat UI 从 `@freeanima/habitat-contract/api` 导入 Row / 响应类型

详情：[`drizzle-db.md`](drizzle-db.md) DbRow / FTS 列名约定。

## Security and continuity

- Credentials and secrets never in git / logs / tool return values
- Memory and self-layer changes need extra care — [`docs/concepts/identity.md`](../../docs/concepts/identity.md)
- Continuity over feature pile-up; simple infra in-house, complex logic via mature third-party libs

## 横切审查清单（重构 / 大改后）

| 领域   | 检查项                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 安全   | 凭证路径不入 log / tool 返回；Habitat REST 输入校验；memory/self-layer 变更对照 [`identity.md`](../../docs/concepts/identity.md) |
| 性能   | PG 查询热点（`src/host/core/db/pg`）；EventBus/Redis；流式 merge（`src/host/core/provider/stream-tools.ts`）                     |
| 可测性 | colocated 单测 + `tests/integration/` 覆盖 boot / Habitat RPC 路径 gaps                                                          |

**New PG domain**: `src/host/core/db/schema/{domain}` → repos in `src/host/core/db/pg/{domain}/` → barrel `index.ts` + `types.ts` → consumers import `@freeanima/host/core/db/pg/{domain}`。

**Flow**: change `src/host/core/db/schema/` → **`drizzle-kit generate`** → **`migrate`**.

| Step | Command / action                                   | Output                                                                     |
| ---- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | Change Drizzle schema (`src/host/core/db/schema/`) | TypeScript SSOT                                                            |
| 2    | `DATABASE_URL=… just db generate`                  | `src/host/core/migrations/{ts}_{name}/migration.sql` + **`snapshot.json`** |
| 3    | `DATABASE_URL=… just db migrate`                   | PG applies DDL; production may auto-migrate on `anima service` start       |

**Forbidden**:

- **Skip `generate` and hand-write `migration.sql` only** (missing `snapshot.json` breaks Drizzle snapshot chain; next `generate` may recreate tables)
- **Edit SQL / delete snapshot in already-applied migration dirs** (add a new migration to fix)

**Allowed**: after `generate`, **append** SQL Drizzle cannot express in that migration's `migration.sql` (e.g. `CREATE EXTENSION`, `message_fts_input()`, some GIN expression indexes); **do not** use this to replace the whole generate step.

**Data migration (required when DDL drops or renames a populated table)**:

- **Co-locate with schema migration** — backfill / `INSERT … SELECT` / column moves belong in the **same** `src/host/core/migrations/{ts}_{name}/migration.sql` as the DDL, appended after `db:generate` output.
- **Order**: copy/transform data **before** `DROP TABLE` / destructive DDL in that file. Habitat startup runs `runMigrations` only; it does **not** run standalone scripts under `scripts/`.
- **Forbidden**: a migration that `DROP TABLE` legacy data without an in-file backfill in the same migration; a separate manual script as the **only** migration path (scripts may exist for dry-run / repair, but production path must be the migration SQL).
- One-off repair scripts (`scripts/*.ts`) are for operator recovery or idempotent re-runs after the fact — not a substitute for the migration chain.

Table shapes SSOT: [`src/host/core/db/schema/`](../../src/host/core/db/schema/). User ops (install, backup): [`docs/guide/database.md`](../../docs/guide/database.md).

Repository query conventions (ORM vs `db.execute`, DbRow typing): [`drizzle-db.md`](drizzle-db.md).

## Service 日志（error.log）

- **`~/.anima/error.log`**（service file sink）用于 **非预期失败** 与需介入的 **warn**；不是业务步骤的运行史。
- 业务步骤的成功 / 预期跳过：以 **PG**（如 `pipeline_step_run.output`）或专用业务落盘为 SSOT；Habitat 读 DB，运维不靠 error.log。
- **不要**为运维复述向 service logger 打 `info`（会同时进 stderr + error.log）；**不要**维护与 PG 重复的本地 JSON 运行史（如已入库的 deep sleep round log）。

## LLM profile 回退

- 内置场景 id：`chat` / `summary` / `reflect`（`PROFILE_*` 常量）
- 请求场景 profile 时，若 runtime（`habitat_runtime_config`）的 `llm.profiles` **未配置**该 id，**必须回退**到 `llm.default_profile`
- 回退 SSOT：`ProfileRegistry.resolve()`（运行时）、`resolveConfiguredProfileId()` / `getProfileHopModel()`（读配置）；调用方仍传场景常量，勿在各功能点手写 fallback

## Release

- **Do not manually edit [`CHANGELOG.md`](../../CHANGELOG.md)** — Release Please only
- Commit conventions and release flow: [`release.md`](release.md)
