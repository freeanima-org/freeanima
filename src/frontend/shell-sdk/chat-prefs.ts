/** 本机聊天偏好（localStorage，不同步 Habitat） */

export const CHAT_LLM_DEBUG_ENABLED_KEY = "freeanima.chat.llmDebugEnabled";

type ChatPrefsListener = () => void;
const listeners = new Set<ChatPrefsListener>();

let memoryFallback: boolean | null = null;

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function readChatLlmDebugEnabled(): boolean {
  try {
    const raw = storage()?.getItem(CHAT_LLM_DEBUG_ENABLED_KEY);
    if (raw == null && memoryFallback != null) return memoryFallback;
    return raw === "1";
  } catch {
    return memoryFallback === true;
  }
}

export function writeChatLlmDebugEnabled(enabled: boolean): void {
  try {
    const store = storage();
    if (store) {
      if (enabled) store.setItem(CHAT_LLM_DEBUG_ENABLED_KEY, "1");
      else store.removeItem(CHAT_LLM_DEBUG_ENABLED_KEY);
    } else {
      memoryFallback = enabled;
    }
  } catch {
    memoryFallback = enabled;
  }
  for (const listener of listeners) listener();
}

export function subscribeChatLlmDebugEnabled(listener: ChatPrefsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetChatPrefsForTest(): void {
  memoryFallback = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(CHAT_LLM_DEBUG_ENABLED_KEY);
  }
}
