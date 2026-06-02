# 集成测试套件

根目录 `tests/` 为 workspace 成员 `@freeanima/integration-tests`，仅承载**集成测试**与共享 helpers。各子包单元测试仍在 `packages/<pkg>/tests/unit/`。

## 目录

```
tests/
  helpers/           # describePg、beginIntegrationCase、waitFor 等
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

# 单元测试（各 package，不进 pre-commit 以外的慢路径）
pnpm test
```

勿对集成测试使用生产 `DATABASE_URL`。

PG harness 实现仍在 `@freeanima/legacy-db/test-helpers`；本目录 helpers 负责用例编排与 `describePg` 门控。
