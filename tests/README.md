# Test suite

The root `tests/` directory hosts **cross-package integration tests** and shared helpers.

**Full-stack black-box E2E** (Compose + Playwright) lives in [freeanima-testing](https://github.com/freeanima-org/freeanima-testing)。主仓 PR dispatch **已暂停**（`ci.yml` `blackbox-dispatch` `if: false`）；恢复方式见该 job 注释。

**Unit tests are always co-located**: `src/**/*.test.ts` (`bun:test`). Do not use `{pkg}/tests/unit/`.

## Layers

| Layer         | Location                                                                | External I/O                                                                        |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Unit          | `src/**/*.test.ts`                                                      | mock + in-memory only (see [`.agent/rules/testing.md`](../.agent/rules/testing.md)) |
| Integration   | `tests/integration/`                                                    | PG, Redis, temp `FREEANIMA_HOME`, `beginIntegrationCase`                            |
| Black-box E2E | [freeanima-testing](https://github.com/freeanima-org/freeanima-testing) | Docker PG/Redis + source start + Playwright                                         |

## Layout

```
tests/
  helpers/           # integration: describePg, beginIntegrationCase, pg-test, etc.
  integration/
    db/
    runtime/
    ...
```

## Running

```bash
just qa test-unit          # bun test src
just qa test-integration   # integration（无 Docker 时 PG 用例跳过）
just qa test-integration -- tests/integration/memory/foo.test.ts  # 子集
just test               # unit 后 integration（串行）
just qa test-changed       # pre-commit：src 内变更的单元测试
just check              # typecheck + lint + format + test-changed
```

- 有 Docker 时，[`scripts/integration-pg-setup.ts`](../scripts/integration-pg-setup.ts) 会建模板库并注入 `ANIMA_TEST_PG_URL`；`just qa test-integration` 默认 `--parallel`（每 worker 克隆独立库，**无 clearPgTables**）。
- **禁止**把 `ANIMA_TEST_PG_URL` 指到日常 `~/.anima` / `config.yaml` 同 host:port（护栏 skip + throw）；细则见 [`.agent/rules/testing.md`](../.agent/rules/testing.md)。
- Before opening a PR, run full `just test` occasionally, not only `just qa test-changed`.

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
