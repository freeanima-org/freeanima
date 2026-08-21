/** 整页刷新 / 刷新按钮后恢复进行中的流式输出 */

const STORAGE_KEY = "freeanima:chat:active-stream";

export type PersistedActiveStream = {
  conversationId: string;
  streamId: string;
};

export function readPersistedActiveStream(conversationId?: string): PersistedActiveStream | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse 边界
    const parsed = JSON.parse(raw) as PersistedActiveStream;
    if (
      typeof parsed?.conversationId !== "string" ||
      typeof parsed?.streamId !== "string" ||
      !parsed.conversationId ||
      !parsed.streamId
    ) {
      return null;
    }
    if (conversationId && parsed.conversationId !== conversationId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedActiveStream(conversationId: string, streamId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ conversationId, streamId } satisfies PersistedActiveStream),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearPersistedActiveStream(conversationId?: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (conversationId) {
      const cur = readPersistedActiveStream();
      if (cur && cur.conversationId !== conversationId) return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
