# 测试套件

根目录 `tests/` 为 workspace 成员 `@freeanima/integration-tests`，承载**跨包集成测试**与共享 helpers。

**全栈黑盒 E2E**（Compose + Playwright）在独立仓库 [freeanima-testing](https://github.com/freeanima-org/freeanima-testing)；主仓 PR 在 Quality 通过后 `repository_dispatch` 触发。

**单元测试一律旁置**：`{layer}/{pkg}/src/**/*.test.ts`（`bun:test`）。禁止 `{pkg}/tests/unit/`。

## 分层

| 层级     | 位置                                                                    | 外部 I/O                                                 |
| -------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| 单元     | `{pkg}/src/**/*.test.ts`                                                | 仅 mock + 内存（见 AGENTS.md 原包 Mock 导出）            |
| 集成     | `tests/integration/`                                                    | PG、Redis、临时 `FREEANIMA_HOME`、`beginIntegrationCase` |
| 黑盒 E2E | [freeanima-testing](https://github.com/freeanima-org/freeanima-testing) | Docker PG/Redis + 源码启动 + Playwright                  |

## 目录

```
tests/
  helpers/           # 集成测：describePg、beginIntegrationCase、pg-test 等
  integration/
    db/
    engine/
    ...
```

## 运行

```bash
bun run test:unit          # 单元全量
bun run test:integration   # 集成（需 Docker 或 PG 用例 skip）
bun run test               # 单元 + 集成 并行
bun run test:changed       # pre-commit：仅单元 changed
bun run check              # typecheck + lint + format + test:changed
```

- `test` / `test:integration` 有 Docker 时由 [`scripts/integration-pg-setup.ts`](../scripts/integration-pg-setup.ts) 注入 `ANIMA_TEST_PG_URL`。
- 推 PR 前除 `test:changed` 外应偶尔跑全量 `bun run test`。

## 主仓 ↔ testing-repo 联动

| 仓库                  | Secret                         | 用途                                       |
| --------------------- | ------------------------------ | ------------------------------------------ |
| **freeanima**         | `TESTING_REPO_DISPATCH_PAT`    | PR 通过后 dispatch `pr-verify`             |
| **freeanima-testing** | `MAIN_REPO_STATUS_PAT`（可选） | 回写 PR commit status `freeanima/blackbox` |

Fine-grained PAT：`freeanima` 侧需对 `freeanima-testing` 有 **Actions: Read and write**；testing 侧需对 `freeanima` 有 **Commit statuses: Read and write**。

## 集成测标准生命周期

```typescript
describePg("...", () => {
  const prev = process.env.FREEANIMA_HOME;
  beforeEach(() => beginIntegrationCase("prefix-"));
  afterEach(() => restoreIntegrationHome(prev));
  afterAll(() => endIntegrationCase());
});
```
