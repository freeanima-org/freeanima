# just db …（需 DATABASE_URL；cwd 进 packages/habitat/core，使 drizzle.config 相对路径生效）
import '_common.just'

[no-cd]
generate: _deps
  cd packages/habitat/core && {{ bun }} x drizzle-kit generate

# 从 pgTable + 覆盖映射 codegen 纯 Zod → shared/pg-shapes/rows
[no-cd]
shapes: _deps
  {{ bun }} scripts/gen-shared-shapes/main.ts
  {{ bun }} x oxfmt packages/shared/pg-shapes/rows

[no-cd]
shapes-check: _deps
  {{ bun }} scripts/check-shared-shapes.ts

[no-cd]
migrate: _deps
  cd packages/habitat/core && {{ bun }} x drizzle-kit migrate
