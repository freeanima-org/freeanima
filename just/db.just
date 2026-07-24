# just db …（需 DATABASE_URL）
import '_common.just'

[no-cd]
generate: _deps
  bunx drizzle-kit generate --config src/host/core/drizzle.config.ts

[no-cd]
migrate: _deps
  bunx drizzle-kit migrate --config src/host/core/drizzle.config.ts
