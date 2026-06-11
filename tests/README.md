# Test suite

The root `tests/` directory is workspace member `@freeanima/integration-tests`, hosting **cross-package integration tests** and shared helpers.

**Full-stack black-box E2E** (Compose + Playwright) lives in [freeanima-testing](https://github.com/freeanima-org/freeanima-testing); main-repo PRs trigger `repository_dispatch` after Quality passes.

**Unit tests are always co-located**: `{layer}/{pkg}/src/**/*.test.ts` (`bun:test`). Do not use `{pkg}/tests/unit/`.

## Layers

| Layer         | Location                                                                | External I/O                                                                        |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Unit          | `{pkg}/src/**/*.test.ts`                                                | mock + in-memory only (see [`.agent/rules/testing.md`](../.agent/rules/testing.md)) |
| Integration   | `tests/integration/`                                                    | PG, Redis, temp `FREEANIMA_HOME`, `beginIntegrationCase`                            |
| Black-box E2E | [freeanima-testing](https://github.com/freeanima-org/freeanima-testing) | Docker PG/Redis + source start + Playwright                                         |

## Layout

```
tests/
  helpers/           # integration: describePg, beginIntegrationCase, pg-test, etc.
  integration/
    db/
    engine/
    ...
```

## Running

```bash
bun run test:unit          # all unit tests
bun run test:integration   # integration (PG cases skip without Docker)
bun run test               # unit + integration in parallel
bun run test:changed       # pre-commit: changed unit tests only
bun run check              # typecheck + lint + format + test:changed
```

- With Docker, [`scripts/integration-pg-setup.ts`](../scripts/integration-pg-setup.ts) injects `ANIMA_TEST_PG_URL` for `test` / `test:integration`.
- Before opening a PR, run full `bun run test` occasionally, not only `test:changed`.

## Main repo ↔ testing-repo wiring

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
