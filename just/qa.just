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
  {{ bun }} test packages scripts/oxlint-plugins --pass-with-no-tests --changed
  {{ bun }} scripts/check-frontend-no-drizzle.ts
  {{ bun }} scripts/check-shared-shapes.ts
  {{ bun }} scripts/check-package-deps.ts
  {{ bun }} scripts/check-package-paths.ts
  {{ bun }} scripts/check-external-deps.ts
  {{ bun }} scripts/check-layer-deps.ts
  {{ bun }} scripts/check-module-globals.ts
  {{ bun }} scripts/check-boot-plugin-parity.ts
  {{ bun }} scripts/check-retired-imports.ts

# 抽样：Vite 解析 task/vault/diary UI + portal-sdk，断言模块图无 drizzle-orm
[no-cd]
check-frontend-no-drizzle: _deps
  {{ bun }} scripts/check-frontend-no-drizzle.ts

[no-cd]
check-shared-shapes: _deps
  {{ bun }} scripts/check-shared-shapes.ts

[no-cd]
check-package-deps: _deps
  {{ bun }} scripts/check-package-deps.ts

# packages/* 路径字面量必须指向真实目录（分包后脚本/CLI 字面量不得指向退役树）
[no-cd]
check-package-paths: _deps
  {{ bun }} scripts/check-package-paths.ts

# 包内第三方 import 必须写在该包 package.json（拆包/搬迁易漏）
[no-cd]
check-external-deps: _deps
  {{ bun }} scripts/check-external-deps.ts

# 13 包 DAG 层依赖（含相对路径 / 测试文件）；存量基线棘轮
[no-cd]
check-layer-deps: _deps
  {{ bun }} scripts/check-layer-deps.ts

# 模块级进程上下文/服务定位桥存量棘轮（P3 目标 0）
[no-cd]
check-module-globals: _deps
  {{ bun }} scripts/check-module-globals.ts

# cordis.yml 与 TS 侧插件清单一致性
[no-cd]
check-boot-plugin-parity: _deps
  {{ bun }} scripts/check-boot-plugin-parity.ts

# 退役 import 前缀禁令（无残留旧前缀）
[no-cd]
check-retired-imports: _deps
  {{ bun }} scripts/check-retired-imports.ts

# husky pre-commit（与钩子同集合，避免漂移）
[no-cd]
pre-commit: _deps
  {{ bun }} x tsgo -p tsconfig.json
  {{ bun }} x oxlint .
  {{ bun }} x oxfmt --check .
  {{ bun }} scripts/check-package-paths.ts
  {{ bun }} scripts/check-external-deps.ts
  {{ bun }} test packages scripts/oxlint-plugins --pass-with-no-tests --changed

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
  {{ bun }} test packages scripts/oxlint-plugins --pass-with-no-tests
  {{ bun }} scripts/run-integration-tests.ts

[no-cd]
test-unit: _deps
  {{ bun }} test packages scripts/oxlint-plugins --pass-with-no-tests

[no-cd]
test-unit-core: _deps
  {{ bun }} scripts/run-unit-core-tests.ts

[no-cd]
test-integration *args: _deps
  {{ bun }} scripts/run-integration-tests.ts {{args}}

[no-cd]
test-changed: _deps
  {{ bun }} test packages scripts/oxlint-plugins --pass-with-no-tests --changed

[no-cd]
test-coverage: _deps
  {{ bun }} test packages scripts/oxlint-plugins --coverage --pass-with-no-tests

[no-cd]
coverage-cobertura: _deps
  {{ bun }} scripts/run-tests.ts --coverage && bun scripts/lcov-to-cobertura.ts

[no-cd]
coverage-threshold: _deps
  {{ bun }} scripts/check-coverage-threshold.ts
