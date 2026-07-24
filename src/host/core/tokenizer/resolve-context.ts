export type ResolveContext = {
  ollamaBaseUrls?: string[];
};

let resolveContext: ResolveContext = {};

export function setResolveContext(ctx: ResolveContext): void {
  resolveContext = { ...ctx };
}

export function getResolveContext(): ResolveContext {
  return resolveContext;
}

export function resetResolveContextForTest(): void {
  resolveContext = {};
}
