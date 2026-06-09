# 测试套件

根目录 `tests/` 为 workspace 成员 `@freeanima/integration-tests`，承载**跨包集成测试**、E2E 与共享 helpers。

**单元测试一律旁置**：`{layer}/{pkg}/src/**/*.test.ts`（`bun:test`）。禁止 `{pkg}/tests/unit/`。

## 分层

| 层级 | 路径                     | 外部 I/O                                                 |
| ---- | ------------------------ | -------------------------------------------------------- |
| 单元 | `{pkg}/src/**/*.test.ts` | 仅 mock + 内存（见 AGENTS.md 原包 Mock 导出）            |
| 集成 | `tests/integration/`     | PG、Redis、临时 `FREEANIMA_HOME`、`beginIntegrationCase` |
| E2E  | `tests/e2e/`             | WebView + Chromium + PG + HTTP                           |

## 目录

```
tests/
  helpers/           # 仅集成测：describePg、beginIntegrationCase、pg-test 等（无 wait.ts）
  integration/
    db/
    engine/
    memory/
    runtime/
    server/
    integrations/
    clarify/
    schemas/
  e2e/
    webui/
```

## 运行

```bash
bun run test              # 单元 + 集成（有 Docker 时自动起临时 PG 17 + migrate；无 Docker 时 PG 用例 skip）
bun run test:changed      # pre-commit：仅变更相关测试
bun run test:e2e          # E2E（需 Chromium + PG）
bun run check             # typecheck + lint + format + test:changed
```

- 集成测有 Docker 时由 [`scripts/integration-pg-setup.ts`](../scripts/integration-pg-setup.ts) 注入 `ANIMA_TEST_PG_URL`；PG harness 在 [`tests/helpers/pg-test.ts`](helpers/pg-test.ts)。
- EventBus / 记忆 FTS 依赖 **bun:sqlite**（Bun 运行时）。
- 勿对集成测试使用生产 `DATABASE_URL`。
- 推 PR 前除 `test:changed` 外应偶尔跑全量 `bun run test`。

## 集成测标准生命周期

```typescript
describePg("...", () => {
  const prev = process.env.FREEANIMA_HOME;
  beforeEach(() => beginIntegrationCase("prefix-"));
  afterEach(() => restoreIntegrationHome(prev));
  afterAll(() => endIntegrationCase());
});
```
