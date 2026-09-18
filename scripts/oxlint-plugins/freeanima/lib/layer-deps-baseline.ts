/**
 * 层依赖存量基线（棘轮）—— 由 `bun scripts/check-layer-deps.ts --update` 生成，勿手改。
 *
 * `"<from> -> <to>"` → 允许存在该层对违规的仓库相对文件清单。
 * 只减不增；新文件出现违规即失败（oxlint `freeanima/layer-deps` 与
 * `scripts/check-layer-deps.ts` 共用本表）。
 */
export const LAYER_DEPS_BASELINE: Readonly<Record<string, readonly string[]>> = {
  "features -> portal-sdk": [
    "packages/features/companion/server/config.ts",
  ],
  "features -> server": [
    "packages/features/chat/habitat/routes/index.ts",
    "packages/features/habitat/habitat/habitat-api/server.ts",
    "packages/features/habitat/habitat/habitat-api/service-auth.ts",
    "packages/features/habitat/habitat/habitat-api/tls-ca-auth.test.ts",
  ],
  "portal-sdk -> portal": [
    "packages/portal-sdk/pomodoro-active.ts",
  ],
  "ui-features -> portal": [
    "packages/ui-features/coding/ui/spa/main.tsx",
    "packages/ui-features/companion/ui/spa/main.tsx",
    "packages/ui-features/pomodoro/ui/float/main.tsx",
  ],
};
