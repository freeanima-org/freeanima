/**
 * Coding domain 对外 barrel（SPA / Outpost 可安全引用）。
 *
 * 故意不 re-export `note-store`：其依赖 `@freeanima/host/core/db/pg`，
 * Vite 会解析到 `@node-rs/jieba` 的 browser 入口（`jieba-wasm32-wasi`），
 * 导致桌面 Coding SPA 打包失败。Habitat 侧请直接 import `./note-store.ts`。
 */
export {
  buildCreatePublicProjectWorldInput,
  extractStableKeyFromWorldBody,
  findWorldByStableKey,
  resolveProjectWorldId,
  type ResolveProjectWorldDeps,
  type WorldListItem,
} from "./resolve-project-world.ts";

export * from "./project-agent-context/index.ts";
export {
  setProjectAgentContext,
  getProjectAgentContext,
  clearProjectAgentContext,
  clearAllProjectAgentContextsForTest,
} from "./project-context-cache.ts";
