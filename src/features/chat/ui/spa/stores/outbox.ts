import { create } from "zustand";
import { getConversationTail } from "@freeanima/features/chat/ui/spa/lib/api.ts";
import {
  ackChatSend,
  enqueueChatSend,
  type ChatOutboxEntry,
  type OutboxSendStatus,
  updateChatSendText,
} from "@freeanima/features/chat/ui/spa/lib/offline-send-store.ts";
import { omitUndefined } from "@freeanima/host/core/util";

type OutboxState = {
  entries: Record<string, ChatOutboxEntry>;
  flushing: Set<string>;
  hydrate: (entries: ChatOutboxEntry[]) => void;
  setEntryStatus: (clientOpId: string, status: OutboxSendStatus, lastError?: string) => void;
  /** 在线直发：仅挂内存，不写 IDB。 */
  trackLocal: (entry: ChatOutboxEntry) => void;
  /** 传输失败时把 ephemeral 条目写入 IDB outbox。 */
  persistToIdb: (clientOpId: string) => Promise<void>;
  enqueue: (
    conversationId: string,
    text: string,
    expectedTailPos: number,
  ) => Promise<ChatOutboxEntry>;
  discard: (clientOpId: string) => Promise<void>;
  updatePendingText: (clientOpId: string, text: string) => Promise<void>;
  ackEntry: (clientOpId: string) => Promise<void>;
  reevaluateStale: (conversationId: string) => Promise<void>;
  detectStaleForConversation: (conversationId: string) => Promise<string[]>;
};

function patchEntry(
  entries: Record<string, ChatOutboxEntry>,
  clientOpId: string,
  patch: Partial<ChatOutboxEntry>,
): Record<string, ChatOutboxEntry> {
  const prev = entries[clientOpId];
  if (!prev) return entries;
  return { ...entries, [clientOpId]: { ...prev, ...patch } };
}

export const useOutboxStore = create<OutboxState>((set, get) => ({
  entries: {},
  flushing: new Set(),

  hydrate(entries) {
    set((s) => {
      const map: Record<string, ChatOutboxEntry> = {};
      for (const [id, e] of Object.entries(s.entries)) {
        if (e.persisted === false) map[id] = e;
      }
      for (const entry of entries) {
        map[entry.clientOpId] = entry;
      }
      return { entries: map };
    });
  },

  setEntryStatus(clientOpId, status, lastError) {
    set((s) => ({
      entries: patchEntry(
        s.entries,
        clientOpId,
        lastError !== undefined ? { status, lastError } : { status },
      ),
    }));
  },

  trackLocal(entry) {
    set((s) => ({ entries: { ...s.entries, [entry.clientOpId]: entry } }));
  },

  async persistToIdb(clientOpId) {
    const entry = get().entries[clientOpId];
    if (!entry || entry.persisted !== false) return;
    await enqueueChatSend(entry.conversationId, entry.text, entry.expectedTailPos, {
      clientOpId: entry.clientOpId,
    });
    set((s) => ({
      entries: patchEntry(s.entries, clientOpId, { persisted: true }),
    }));
  },

  async enqueue(conversationId, text, expectedTailPos) {
    const entry = await enqueueChatSend(conversationId, text, expectedTailPos);
    set((s) => ({ entries: { ...s.entries, [entry.clientOpId]: entry } }));
    return entry;
  },

  async discard(clientOpId) {
    await ackChatSend(clientOpId);
    set((s) => {
      const next = { ...s.entries };
      delete next[clientOpId];
      return { entries: next };
    });
  },

  async updatePendingText(clientOpId, text) {
    await updateChatSendText(clientOpId, text);
    set((s) => ({
      entries: patchEntry(
        s.entries,
        clientOpId,
        omitUndefined({
          text,
          status: "pending" as const,
          lastError: undefined,
        }),
      ),
    }));
  },

  async ackEntry(clientOpId) {
    await ackChatSend(clientOpId);
    set((s) => {
      if (!(clientOpId in s.entries)) return s;
      const next = { ...s.entries };
      delete next[clientOpId];
      return { entries: next };
    });
  },

  async reevaluateStale(conversationId) {
    const entries = Object.values(get().entries).filter(
      (e) => e.conversationId === conversationId && e.status === "stale",
    );
    if (entries.length === 0) return;
    try {
      const tail = await getConversationTail(conversationId);
      for (const entry of entries) {
        if (entry.expectedTailPos === tail.tail_pos) {
          get().setEntryStatus(entry.clientOpId, "pending");
        }
      }
    } catch {
      // keep stale
    }
  },

  async detectStaleForConversation(conversationId) {
    const candidates = Object.values(get().entries).filter(
      (e) =>
        e.conversationId === conversationId && (e.status === "pending" || e.status === "failed"),
    );
    if (candidates.length === 0) return [];

    let tailPos: number;
    try {
      const tail = await getConversationTail(conversationId);
      tailPos = tail.tail_pos;
    } catch {
      return [];
    }

    const marked: string[] = [];
    for (const entry of candidates) {
      if (entry.expectedTailPos === tailPos) continue;
      get().setEntryStatus(entry.clientOpId, "stale");
      marked.push(entry.clientOpId);
    }
    return marked;
  },
}));
