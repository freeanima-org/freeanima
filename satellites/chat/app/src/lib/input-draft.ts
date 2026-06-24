const KEY_PREFIX = "chat:input-draft:";

export function loadInputDraft(conversationId: string | null): string {
  if (!conversationId) return "";
  try {
    return sessionStorage.getItem(`${KEY_PREFIX}${conversationId}`) ?? "";
  } catch {
    return "";
  }
}

export function saveInputDraft(conversationId: string | null, text: string): void {
  if (!conversationId) return;
  try {
    const key = `${KEY_PREFIX}${conversationId}`;
    if (text) sessionStorage.setItem(key, text);
    else sessionStorage.removeItem(key);
  } catch {
    /* sessionStorage 不可用时忽略 */
  }
}
