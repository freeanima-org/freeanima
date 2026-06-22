const KEY_PREFIX = "parlor:input-draft:";

export function loadInputDraft(sessionId: string | null): string {
  if (!sessionId) return "";
  try {
    return sessionStorage.getItem(`${KEY_PREFIX}${sessionId}`) ?? "";
  } catch {
    return "";
  }
}

export function saveInputDraft(sessionId: string | null, text: string): void {
  if (!sessionId) return;
  try {
    const key = `${KEY_PREFIX}${sessionId}`;
    if (text) sessionStorage.setItem(key, text);
    else sessionStorage.removeItem(key);
  } catch {
    /* sessionStorage 不可用时忽略 */
  }
}
