export type OnSessionCloseBeforeNewFn = (sessionId: string) => Promise<string | null>;

let onSessionCloseBeforeNewImpl: OnSessionCloseBeforeNewFn | null = null;

export function registerOnSessionCloseBeforeNew(fn: OnSessionCloseBeforeNewFn): void {
  onSessionCloseBeforeNewImpl = fn;
}

export function unregisterOnSessionCloseBeforeNew(): void {
  onSessionCloseBeforeNewImpl = null;
}

export async function onSessionCloseBeforeNew(sessionId: string): Promise<string | null> {
  if (!onSessionCloseBeforeNewImpl) {
    throw new Error("onSessionCloseBeforeNew not registered: load @freeanima/service first");
  }
  return onSessionCloseBeforeNewImpl(sessionId);
}
