/**
 * 层依赖存量基线（棘轮）—— 由 `bun scripts/check-layer-deps.ts --update` 生成，勿手改。
 *
 * `"<from> -> <to>"` → 允许存在该层对违规的仓库相对文件清单。
 * 只减不增；新文件出现违规即失败（oxlint `freeanima/layer-deps` 与
 * `scripts/check-layer-deps.ts` 共用本表）。
 */
export const LAYER_DEPS_BASELINE: Readonly<Record<string, readonly string[]>> = {};
