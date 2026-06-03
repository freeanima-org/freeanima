# 集成测试套件

根目录 `tests/` 为 workspace 成员 `@freeanima/integration-tests`，仅承载**集成测试**与共享 helpers。各子包单元测试仍在 `packages/<pkg>/tests/unit/`（`bun:test`）。

## 目录

```
tests/
  helpers/           # describePg、describeSqlite、beginIntegrationCase、waitFor 等
  integration/
    db/              # 按被测域分子目录
    engine/
    memory/
    runtime/
    server/
    integrations/
    clarify/
```

## 运行

```bash
# 需 Docker（Testcontainers 起临时 PostgreSQL 17 + migrate）
bun test:integration

# 单元测试（各 package，bun:test）
bun test
```

`test:integration` 使用 `bun test --config tests/bunfig.toml tests/integration`（见 `scripts/run-integration-tests.mts`）；PG 由 `scripts/integration-pg-setup.ts` 注入 `ANIMA_TEST_PG_URL`。单元测试：根目录 `bun test`（`bunfig.toml`，默认无覆盖率；`bun test --coverage` 或 `bun run test:coverage` 开启，并排除 `tests/integration/**`）。

依赖 **SQLite**（EventBus、L2/L3 FTS）：仅 **bun:sqlite**（运行时要求 Bun）。

勿对集成测试使用生产 `DATABASE_URL`。

PG harness 实现仍在 `@freeanima/legacy-db/test-helpers`；本目录 helpers 负责用例编排与 `describePg` / `describeSqlite` 门控。
