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
    throw new Error("onSessionCloseBeforeNew 未注册：请先加载 @freeanima/service");
  }
  return onSessionCloseBeforeNewImpl(sessionId);
}
