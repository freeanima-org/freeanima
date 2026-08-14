# Test suite

The root `tests/` directory hosts **cross-package integration tests** and shared helpers.

**Full-stack black-box E2E** (Compose + Playwright) lives in [freeanima-testing](https://github.com/freeanima-org/freeanima-testing)。主仓 PR dispatch **已暂停**（`ci.yml` `blackbox-dispatch` `if: false`）；恢复方式见该 job 注释。

**Unit tests are always co-located**: `packages/**/*.test.ts` (`bun:test`). Do not use `{pkg}/tests/unit/`.

## Layers

| Layer         | Location                                                                | External I/O                                                                            |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Unit          | `packages/**/*.test.ts`                                                 | mock + in-memory only (see [`.cursor/rules/testing.mdc`](../.cursor/rules/testing.mdc)) |
| Integration   | `tests/integration/`                                                    | PG, Redis, temp `FREEANIMA_HOME`, `beginIntegrationCase`                                |
| Black-box E2E | [freeanima-testing](https://github.com/freeanima-org/freeanima-testing) | Docker PG/Redis + source start + Playwright                                             |

### Core / enhanced

| 标记     | 如何识别                                                                                                                                  | 门禁                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| core     | `*.core.test.ts` 或 [`tiers/unit-core-globs.txt`](tiers/unit-core-globs.txt) / [`tiers/integration-core.txt`](tiers/integration-core.txt) | unit：pre-push；integration：功能/修 bug 主动跑 |
| enhanced | 其余 `*.test.ts`                                                                                                                          | 仅全量（PR CI / `just test`）                   |

bun:test 无 `--tags`；解析见 [`scripts/test-tiers.ts`](../scripts/test-tiers.ts)。同文件混标：[`helpers/test-tier.ts`](helpers/test-tier.ts)。

## Layout

```
tests/
  helpers/           # describePg, beginIntegrationCase, test-tier, …
  tiers/             # core 路径清单（SSOT）
  integration/
    db/
    runtime/
    ...
```

## Running

```bash
just qa test-unit                        # 全量 unit
just qa test-unit-core                   # unit CORE（= pre-push）
just qa test-integration                 # 全量 integration（无 Docker 时 PG 跳过）
just qa test-integration -- --core       # integration CORE（功能/修 bug 主动）
just qa test-integration -- tests/integration/memory/foo.test.ts  # 子集
just test                                # unit 后 integration（串行，全量）
just qa test-changed                     # pre-commit：变更相关 unit
just qa pre-push                         # husky：unit CORE
just check                               # typecheck + lint + format + test-changed
```

- 有 Docker 时，[`scripts/integration-pg-setup.ts`](../scripts/integration-pg-setup.ts) 会建模板库并注入 `ANIMA_TEST_PG_URL`；`just qa test-integration` 默认 `--parallel`（每 worker 克隆独立库，**无 clearPgTables**）。
- **禁止**把 `ANIMA_TEST_PG_URL` 指到日常 `~/.anima` / `config.yaml` 同 host:port（护栏 skip + throw）；细则见 [`.cursor/rules/testing.mdc`](../.cursor/rules/testing.mdc)。
- 功能变更 / bug 修复：主动 `just qa test-unit` + `just qa test-integration -- --core`（勿只跑 `--changed`）。
- PR CI 跑全量 unit + integration（`scripts/run-ci-tests.ts`）。

## Main repo ↔ testing-repo binding

| Repo                  | Secret                          | Purpose                                               |
| --------------------- | ------------------------------- | ----------------------------------------------------- |
| **freeanima**         | `FREEANIMA_CI`                  | Release Please + dispatch `pr-verify` after PR passes |
| **freeanima-testing** | `FREEANIMA_CI` or dedicated PAT | write back PR commit status `freeanima/blackbox`      |

Fine-grained PAT: **freeanima** side needs **Actions: Read and write** on `freeanima-testing`; testing side needs **Commit statuses: Read and write** on `freeanima`.

## Standard integration test lifecycle

```typescript
describePg("...", () => {
  const prev = process.env.FREEANIMA_HOME;
  beforeEach(() => beginIntegrationCase("prefix-"));
  afterEach(() => restoreIntegrationHome(prev));
  afterAll(() => endIntegrationCase());
});
```

`restoreIntegrationHome` waits for async compression, removes conversation `anima-cwd-*` directories referenced in PG, deletes the temp `FREEANIMA_HOME` tree, then restores the prior env.
