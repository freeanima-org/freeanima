/** Per-agent self-layer prompt cache */
const cachedByAgent = new Map<number, string>();

export function getSelfLayerPromptCache(agentSubjectId?: number): string {
  if (agentSubjectId == null) return "";
  return cachedByAgent.get(agentSubjectId) ?? "";
}

export function setSelfLayerPromptCache(prompt: string, agentSubjectId: number): void {
  cachedByAgent.set(agentSubjectId, prompt.trim());
}

export function invalidateSelfLayerPromptCache(agentSubjectId?: number): void {
  if (agentSubjectId == null) {
    cachedByAgent.clear();
    return;
  }
  cachedByAgent.delete(agentSubjectId);
}
