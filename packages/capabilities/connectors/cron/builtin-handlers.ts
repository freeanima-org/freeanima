const handlers = new Map<string, () => Promise<string>>();

export function registerCronBuiltinHandler(id: string, fn: () => Promise<string>): void {
  handlers.set(id, fn);
}

export function unregisterCronBuiltinHandler(id: string): void {
  handlers.delete(id);
}

export function resetCronBuiltinHandlersForTests(): void {
  handlers.clear();
}

export async function runCronBuiltinHandler(id: string): Promise<string | null> {
  const fn = handlers.get(id);
  if (!fn) return null;
  return fn();
}
