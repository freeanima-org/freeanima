let resolveSessionId: (() => string | undefined) | null = null;

/** Injected by service at startup (avoids capabilities-memory depending on engine-loop) */
export function registerToolConversationResolver(fn: () => string | undefined): void {
  resolveSessionId = fn;
}

export function resetToolSessionResolverForTests(): void {
  resolveSessionId = null;
}

export function getToolConversationIdForMemory(): string | undefined {
  return resolveSessionId?.();
}
