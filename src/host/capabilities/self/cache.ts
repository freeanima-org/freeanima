let cachedPrompt: string | null = null;

export function getSelfLayerPromptCache(): string {
  return cachedPrompt ?? "";
}

export function setSelfLayerPromptCache(prompt: string): void {
  cachedPrompt = prompt.trim();
}

export function invalidateSelfLayerPromptCache(): void {
  cachedPrompt = null;
}
