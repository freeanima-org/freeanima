# just qa …（质量：check / lint / fmt / test）
import '_common.just'

# PR 前：typecheck + lint（含 freeanima jsPlugins 护栏）+ stylelint + format + test:changed
# 注：≠ 全量 CI（CI 另跑 bun scripts/run-ci-tests.ts）
[no-cd]
check: _deps
  {{ bun }} x tsgo -p tsconfig.json
  {{ bun }} x oxlint .
  {{ bun }} scripts/stylelint.ts
  {{ bun }} x oxfmt --check .
  {{ bun }} test src scripts/oxlint-plugins --pass-with-no-tests --changed

# husky pre-commit（与钩子同集合，避免漂移）
[no-cd]
pre-commit: _deps
  {{ bun }} x tsgo -p tsconfig.json
  {{ bun }} x oxlint .
  {{ bun }} x oxfmt --check .
  {{ bun }} test src scripts/oxlint-plugins --pass-with-no-tests --changed

# husky pre-push：仅 unit CORE（集成不跑）
[no-cd]
pre-push: _deps
  {{ bun }} scripts/run-unit-core-tests.ts

[no-cd]
typecheck: _deps
  {{ bun }} x tsgo -p tsconfig.json

[no-cd]
lint: _deps
  {{ bun }} x oxlint .

[no-cd]
lint-fix: _deps
  {{ bun }} x oxlint --fix .

[no-cd]
stylelint: _deps
  {{ bun }} scripts/stylelint.ts

[no-cd]
stylelint-fix: _deps
  {{ bun }} scripts/stylelint.ts --fix

[no-cd]
fmt: _deps
  {{ bun }} x oxfmt .

[no-cd]
fmt-check: _deps
  {{ bun }} x oxfmt --check .

# 全量单元 + 集成（串行）
[no-cd]
test: _deps
  {{ bun }} test src --pass-with-no-tests
  {{ bun }} scripts/run-integration-tests.ts

[no-cd]
test-unit: _deps
  {{ bun }} test src --pass-with-no-tests

[no-cd]
test-unit-core: _deps
  {{ bun }} scripts/run-unit-core-tests.ts

[no-cd]
test-integration *args: _deps
  {{ bun }} scripts/run-integration-tests.ts {{args}}

[no-cd]
test-changed: _deps
  {{ bun }} test src --pass-with-no-tests --changed

[no-cd]
test-coverage: _deps
  {{ bun }} test --coverage --pass-with-no-tests

[no-cd]
coverage-cobertura: _deps
  {{ bun }} scripts/run-tests.ts --coverage && bun scripts/lcov-to-cobertura.ts

[no-cd]
coverage-threshold: _deps
  {{ bun }} scripts/check-coverage-threshold.ts
