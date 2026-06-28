const KEY_PREFIX = "chat:input-draft:";

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function loadInputDraft(conversationId: string | null): string {
  if (!conversationId) return "";
  try {
    return storage()?.getItem(`${KEY_PREFIX}${conversationId}`) ?? "";
  } catch {
    return "";
  }
}

export function saveInputDraft(conversationId: string | null, text: string): void {
  if (!conversationId) return;
  try {
    const store = storage();
    if (!store) return;
    const key = `${KEY_PREFIX}${conversationId}`;
    if (text) store.setItem(key, text);
    else store.removeItem(key);
  } catch {
    /* localStorage 不可用时忽略 */
  }
}
