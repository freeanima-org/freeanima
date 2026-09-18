/**
 * 层依赖存量基线（棘轮）—— 由 `bun scripts/check-layer-deps.ts --update` 生成，勿手改。
 *
 * `"<from> -> <to>"` → 允许存在该层对违规的仓库相对文件清单。
 * 只减不增；新文件出现违规即失败（oxlint `freeanima/layer-deps` 与
 * `scripts/check-layer-deps.ts` 共用本表）。
 */
export const LAYER_DEPS_BASELINE: Readonly<Record<string, readonly string[]>> = {
  "app-frame -> core": [
    "packages/app-frame/spa/settings/habitat-config/llm-settings-draft.ts",
    "packages/app-frame/spa/settings/habitat-config/llm-settings-forms.tsx",
  ],
  "capabilities -> features": [
    "packages/capabilities/connectors/email/idle.ts",
    "packages/capabilities/connectors/email/imap-client.ts",
    "packages/capabilities/connectors/email/index.ts",
    "packages/capabilities/connectors/email/mailbox-ops.ts",
    "packages/capabilities/connectors/email/new-mail-notify.test.ts",
    "packages/capabilities/connectors/email/new-mail-notify.ts",
    "packages/capabilities/connectors/email/password.ts",
    "packages/capabilities/connectors/email/send.ts",
    "packages/capabilities/connectors/email/sent-copy.ts",
    "packages/capabilities/connectors/email/sync.ts",
    "packages/capabilities/connectors/vault/agent-secrets.ts",
    "packages/capabilities/connectors/vault/user-secrets.ts",
    "packages/capabilities/federation/hub-ws-server.ts",
    "packages/capabilities/federation/satellite-client.ts",
    "packages/capabilities/outpost/transport/ws-server.ts",
    "packages/capabilities/tools/media/tools.ts",
    "packages/capabilities/tools/subprocess-secrets.ts",
  ],
  "capabilities -> server": [
    "packages/capabilities/connectors/cron/module.ts",
    "packages/capabilities/outpost/transport/bun-route.ts",
    "packages/capabilities/outpost/transport/stream-bridge.ts",
    "packages/capabilities/outpost/transport/types.ts",
    "packages/capabilities/outpost/transport/ws-server.ts",
  ],
  "features -> portal-sdk": ["packages/features/companion/server/config.ts"],
  "features -> server": [
    "packages/features/calendar/domain/convert-task-event.ts",
    "packages/features/chat/habitat/routes/index.ts",
    "packages/features/email/domain/attach-task.ts",
    "packages/features/habitat/habitat/asr-handler.ts",
    "packages/features/habitat/habitat/habitat-api/handlers/service-api-tokens.ts",
    "packages/features/habitat/habitat/habitat-api/handlers/tls-ca.ts",
    "packages/features/habitat/habitat/habitat-api/server.ts",
    "packages/features/habitat/habitat/habitat-api/service-auth.ts",
    "packages/features/habitat/habitat/habitat-api/tls-ca-auth.test.ts",
    "packages/features/habitat/habitat/routes/index.ts",
    "packages/features/habitat/habitat/tts-handler.ts",
    "packages/features/notification/habitat/runtime-deps.ts",
    "packages/features/subagent/domain/subagent-tools.ts",
    "packages/features/task/domain/item-store.ts",
    "packages/features/task/habitat/advance-reminder-stream.ts",
    "packages/features/workflow/domain/runner.ts",
    "packages/features/workflow/domain/workflow-tools.ts",
  ],
  "portal-sdk -> portal": ["packages/portal-sdk/pomodoro-active.ts"],
  "ui-features -> portal": [
    "packages/ui-features/coding/ui/spa/main.tsx",
    "packages/ui-features/companion/ui/spa/main.tsx",
    "packages/ui-features/pomodoro/ui/float/main.tsx",
  ],
  "ui-kit -> portal-sdk": [
    "packages/ui-kit/composite/EntityIdLabel.tsx",
    "packages/ui-kit/lib/task-list-tree.ts",
  ],
};
