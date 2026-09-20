export type ResolveContext = {
  ollamaBaseUrls?: string[];
};

let context: ResolveContext = {};

export function setResolveContext(next: ResolveContext): void {
  context = { ...next };
}

export function getResolveContext(): ResolveContext {
  return context;
}

export function resetResolveContextForTest(): void {
  context = {};
}
