export type OnConversationCloseBeforeNewFn = (conversationId: string) => Promise<string | null>;

let onConversationCloseBeforeNewImpl: OnConversationCloseBeforeNewFn | null = null;

export function registerOnConversationCloseBeforeNew(fn: OnConversationCloseBeforeNewFn): void {
  onConversationCloseBeforeNewImpl = fn;
}

export function unregisterOnConversationCloseBeforeNew(): void {
  onConversationCloseBeforeNewImpl = null;
}

export async function onConversationCloseBeforeNew(conversationId: string): Promise<string | null> {
  if (!onConversationCloseBeforeNewImpl) {
    throw new Error("onConversationCloseBeforeNew not registered: load @freeanima/platform first");
  }
  return onConversationCloseBeforeNewImpl(conversationId);
}
