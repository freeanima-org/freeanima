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
pnpm test:integration

# 单元测试（各 package，bun:test）
pnpm test
```

`test:integration` 使用 `bun test` + `scripts/bunfig.integration.toml`；PG 由 `scripts/integration-pg-setup.ts` 在 runner 启动前注入 `ANIMA_TEST_PG_URL`。

依赖 **better-sqlite3**（EventBus、L2/L3 FTS）的用例在 Bun 下自动 `skip`（与单元测试 `memory-search` 一致）；在 Node 原生模块可用时可跑全量。

勿对集成测试使用生产 `DATABASE_URL`。

PG harness 实现仍在 `@freeanima/legacy-db/test-helpers`；本目录 helpers 负责用例编排与 `describePg` / `describeSqlite` 门控。
