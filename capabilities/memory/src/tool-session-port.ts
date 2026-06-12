let resolveSessionId: (() => string | undefined) | null = null;

/** Injected by service at startup (avoids capabilities-memory depending on engine-loop) */
export function registerToolSessionResolver(fn: () => string | undefined): void {
  resolveSessionId = fn;
}

export function resetToolSessionResolverForTests(): void {
  resolveSessionId = null;
}

export function getToolSessionIdForMemory(): string | undefined {
  return resolveSessionId?.();
}
