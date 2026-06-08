# 集成测试套件

根目录 `tests/` 为 workspace 成员 `@freeanima/integration-tests`，仅承载**集成测试**与共享 helpers。各子包单元测试在 `{layer}/{pkg}/tests/unit/`（`bun:test`）。

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
# 单元 + 集成（有 Docker 时自动起临时 PostgreSQL 17 + migrate；无 Docker 时 PG 用例 skip）
bun test
```

依赖 **SQLite**（EventBus、语义/情景记忆 FTS）：仅 **bun:sqlite**（运行时要求 Bun）。

勿对集成测试使用生产 `DATABASE_URL`。

PG harness 实现仍在 `@freeanima/engine-db/test-helpers`；本目录 helpers 负责用例编排与 `describePg` / `describeSqlite` 门控。
