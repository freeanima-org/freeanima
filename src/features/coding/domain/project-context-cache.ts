/**
 * Coding 会话级项目 Agent 上下文缓存（Outpost sync → prompt / skill_load）。
 * 不入库；Habitat 重启后需 Outpost 再 sync。
 */

import type { ProjectAgentContextSnapshot } from "@freeanima/features/coding/domain";

const cache = new Map<string, ProjectAgentContextSnapshot>();

export function setProjectAgentContext(
  conversationId: string,
  snapshot: ProjectAgentContextSnapshot,
): void {
  cache.set(conversationId, snapshot);
}

export function getProjectAgentContext(
  conversationId: string,
): ProjectAgentContextSnapshot | undefined {
  return cache.get(conversationId);
}

export function clearProjectAgentContext(conversationId: string): void {
  cache.delete(conversationId);
}

/** 测试重置 */
export function clearAllProjectAgentContextsForTest(): void {
  cache.clear();
}
