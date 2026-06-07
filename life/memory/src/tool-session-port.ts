let resolveSessionId: (() => string | undefined) | null = null;

/** 由 service 启动时注入（避免 life-memory 依赖 engine-loop） */
export function registerToolSessionResolver(fn: () => string | undefined): void {
  resolveSessionId = fn;
}

export function resetToolSessionResolverForTests(): void {
  resolveSessionId = null;
}

export function getToolSessionIdForMemory(): string | undefined {
  return resolveSessionId?.();
}
