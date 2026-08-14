/**
 * Coding domain Habitat 侧入口。
 * SPA / Outpost 可安全引用的同构模块在 `@freeanima/shared/coding/*`。
 * 故意不 re-export note-store（依赖 host/core/db/pg）。
 */
export {
  buildCreatePublicProjectWorldInput,
  extractStableKeyFromWorldBody,
  findWorldByStableKey,
  resolveProjectWorldId,
  type ResolveProjectWorldDeps,
  type WorldListItem,
} from "@freeanima/shared/coding/resolve-project-world.ts";

export * from "@freeanima/shared/coding/project-agent-context/index.ts";
export {
  setProjectAgentContext,
  getProjectAgentContext,
  clearProjectAgentContext,
  clearAllProjectAgentContextsForTest,
} from "@freeanima/shared/coding/project-context-cache.ts";
