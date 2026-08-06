# just db …（需 DATABASE_URL；cwd 进 host/core，使 drizzle.config 相对路径生效）
import '_common.just'

[no-cd]
generate: _deps
  cd src/host/core && {{ bun }} x drizzle-kit generate

[no-cd]
migrate: _deps
  cd src/host/core && {{ bun }} x drizzle-kit migrate
