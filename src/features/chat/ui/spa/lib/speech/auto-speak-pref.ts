const STORAGE_KEY = "chat:auto-speak";

function storage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** 顶栏自动朗读开关（跨会话持久化，豆包式习惯） */
export function loadAutoSpeakPref(): boolean {
  try {
    return storage()?.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveAutoSpeakPref(enabled: boolean): void {
  try {
    const store = storage();
    if (!store) return;
    if (enabled) store.setItem(STORAGE_KEY, "1");
    else store.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage 不可用时忽略 */
  }
}
