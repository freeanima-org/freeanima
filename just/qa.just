# just qa …（质量：check / lint / fmt / test）
import '_common.just'

# PR 前：typecheck + lint + import-depth + pg-sql-arrays + stylelint + format + test:changed
# 注：≠ 全量 CI（CI 另跑 bun scripts/run-ci-tests.ts）
[no-cd]
check: _deps
  bunx tsgo -p tsconfig.json
  bunx oxlint .
  bun scripts/check-import-depth.ts
  bun scripts/check-layer-deps.ts
  bun scripts/check-pg-sql-arrays.ts --self-test
  bun scripts/check-pg-sql-arrays.ts
  bun scripts/stylelint.ts
  bunx oxfmt --check .
  bun test src --pass-with-no-tests --changed

# husky pre-commit（与钩子同集合，避免漂移）
[no-cd]
pre-commit: _deps
  bunx tsgo -p tsconfig.json
  bunx oxlint .
  bun scripts/check-import-depth.ts
  bun scripts/check-layer-deps.ts
  bunx oxfmt --check .
  bun test src --pass-with-no-tests --changed

[no-cd]
typecheck: _deps
  bunx tsgo -p tsconfig.json

[no-cd]
lint: _deps
  bunx oxlint .

[no-cd]
lint-fix: _deps
  bunx oxlint --fix .

[no-cd]
stylelint: _deps
  bun scripts/stylelint.ts

[no-cd]
stylelint-fix: _deps
  bun scripts/stylelint.ts --fix

[no-cd]
fmt: _deps
  bunx oxfmt .

[no-cd]
fmt-check: _deps
  bunx oxfmt --check .

# 全量单元 + 集成（串行）
[no-cd]
test: _deps
  bun test src --pass-with-no-tests
  bun scripts/run-integration-tests.ts

[no-cd]
test-unit: _deps
  bun test src --pass-with-no-tests

[no-cd]
test-integration *args: _deps
  bun scripts/run-integration-tests.ts {{args}}

[no-cd]
test-changed: _deps
  bun test src --pass-with-no-tests --changed

[no-cd]
test-coverage: _deps
  bun test --coverage --pass-with-no-tests

[no-cd]
coverage-cobertura: _deps
  bun scripts/run-tests.ts --coverage && bun scripts/lcov-to-cobertura.ts

[no-cd]
coverage-threshold: _deps
  bun scripts/check-coverage-threshold.ts
