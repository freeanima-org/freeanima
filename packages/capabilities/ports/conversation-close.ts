import { platformPorts } from "./service.ts";

export type OnConversationCloseBeforeNewFn = (conversationId: string) => Promise<string | null>;

/** Composition root binds the implementation onto `ctx.platformPorts`. */
export function registerOnConversationCloseBeforeNew(fn: OnConversationCloseBeforeNewFn): void {
  platformPorts().closeBeforeNew = fn;
}

export function unregisterOnConversationCloseBeforeNew(): void {
  platformPorts().closeBeforeNew = null;
}

export async function onConversationCloseBeforeNew(conversationId: string): Promise<string | null> {
  const fn = platformPorts().closeBeforeNew;
  if (!fn) {
    throw new Error("onConversationCloseBeforeNew not registered: load @freeanima/server first");
  }
  return fn(conversationId);
}
