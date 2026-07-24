# just misc …（采样、FBX、归档迁移）
import '_common.just'

# Habitat 内存采样：just misc memory-sample -- --habitat-url http://127.0.0.1:12001 --stage full
[no-cd]
memory-sample *args: _deps
  bun scripts/memory-sample.ts {{args}}

[no-cd]
setup-fbx: _deps
  bun src/features/companion/scripts/ensure-fbx2gltf.ts

# ─── 归档（一次性迁移；勿作日常入口）───────────────────────────────

[no-cd]
migrate-tasks: _deps
  bun scripts/archive/migrate-tasks-to-entities.ts

[no-cd]
migrate-email: _deps
  bun scripts/archive/migrate-email-to-entities.ts

[no-cd]
recover-tasks: _deps
  bun scripts/archive/recover-tasks-from-message-history.ts
