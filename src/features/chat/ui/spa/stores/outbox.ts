import { create } from "zustand";
import {
  RECOVERY_INITIAL_DELAY_MS,
  RECOVERY_MAX_DELAY_MS,
} from "@freeanima/features/chat/ui/spa/lib/display-recovery.ts";
import {
  getConversationTail,
  subscribeMessageStream,
} from "@freeanima/features/chat/ui/spa/lib/api.ts";
import type { StreamApiEvent } from "@freeanima/features/chat/ui/spa/lib/types.ts";
import {
  ackChatSend,
  enqueueChatSend,
  type ChatOutboxEntry,
  type OutboxSendStatus,
  updateChatSendPayload,
  updateChatSendText,
} from "@freeanima/features/chat/ui/spa/lib/offline-send-store.ts";
import { resolveOutboxScope } from "@freeanima/frontend/shell-sdk/offline-outbox";
import { omitUndefined } from "@freeanima/core/util";

type FlushHooks = {
  onStreamEvent: (conversationId: string, ev: StreamApiEvent) => void;
  onDone: (conversationId: string) => void;
  onError: (conversationId: string, msg: string) => void;
  llmDebug?: boolean;
};

type OutboxState = {
  entries: Record<string, ChatOutboxEntry>;
  flushing: Set<string>;
  hydrate: (entries: ChatOutboxEntry[]) => void;
  setEntryStatus: (clientOpId: string, status: OutboxSendStatus, lastError?: string) => void;
  enqueue: (
    conversationId: string,
    text: string,
    expectedTailPos: number,
  ) => Promise<ChatOutboxEntry>;
  discard: (clientOpId: string) => Promise<void>;
  updatePendingText: (clientOpId: string, text: string) => Promise<void>;
  ackEntry: (clientOpId: string) => Promise<void>;
  forceSend: (clientOpId: string, hooks: FlushHooks) => Promise<void>;
  flushConversation: (conversationId: string, hooks: FlushHooks) => Promise<void>;
  flushAll: (hooks: FlushHooks) => Promise<void>;
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

function delayForAttempt(attempts: number): number {
  const base = RECOVERY_INITIAL_DELAY_MS;
  const max = RECOVERY_MAX_DELAY_MS;
  return Math.min(base * 2 ** Math.max(0, attempts - 1), max);
}

async function flushOneEntry(
  entry: ChatOutboxEntry,
  hooks: FlushHooks,
  opts?: { forceTail?: boolean },
): Promise<"done" | "stale" | "failed"> {
  const scope = resolveOutboxScope();
  if (opts?.forceTail) {
    await updateChatSendPayload(entry.clientOpId, { force_tail: true }, scope);
  }

  let tailPos = entry.expectedTailPos;
  if (!opts?.forceTail) {
    try {
      const tail = await getConversationTail(entry.conversationId);
      tailPos = tail.tail_pos;
      if (tail.tail_pos !== entry.expectedTailPos) {
        return "stale";
      }
    } catch {
      return "failed";
    }
  }

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (result: "done" | "stale" | "failed") => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const { unsubscribe } = subscribeMessageStream(
      omitUndefined({
        conversationId: entry.conversationId,
        message: entry.text,
        clientOpId: entry.clientOpId,
        expectedTailPos: tailPos,
        forceTail: opts?.forceTail,
        llmDebug: hooks.llmDebug,
      }),
      {
        onData: (ev) => {
          hooks.onStreamEvent(entry.conversationId, ev as StreamApiEvent);
          if (ev.event === "error") {
            const code = (ev.data as { code?: string }).code;
            if (code === "tail_conflict") {
              finish("stale");
              unsubscribe();
              return;
            }
            hooks.onError(entry.conversationId, ev.data.error);
            finish("failed");
            unsubscribe();
            return;
          }
          if (ev.event === "done") {
            void ackChatSend(entry.clientOpId, scope);
            hooks.onDone(entry.conversationId);
            finish("done");
            unsubscribe();
          }
        },
        onError: (err) => {
          hooks.onError(entry.conversationId, err.message);
          finish("failed");
        },
        onComplete: () => {
          if (!settled) finish("done");
        },
      },
    );
  });
}

export const useOutboxStore = create<OutboxState>((set, get) => ({
  entries: {},
  flushing: new Set(),

  hydrate(entries) {
    const map: Record<string, ChatOutboxEntry> = {};
    for (const entry of entries) {
      map[entry.clientOpId] = entry;
    }
    set({ entries: map });
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

  async forceSend(clientOpId, hooks) {
    const entry = get().entries[clientOpId];
    if (!entry) return;
    set((s) => {
      const flushing = new Set(s.flushing);
      flushing.add(clientOpId);
      return {
        flushing,
        entries: patchEntry(s.entries, clientOpId, { status: "sending" }),
      };
    });
    const result = await flushOneEntry(entry, hooks, { forceTail: true });
    set((s) => {
      const flushing = new Set(s.flushing);
      flushing.delete(clientOpId);
      return { flushing };
    });
    if (result === "done") {
      set((s) => {
        const next = { ...s.entries };
        delete next[clientOpId];
        return { entries: next };
      });
      return;
    }
    get().setEntryStatus(clientOpId, result === "stale" ? "stale" : "failed");
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

  async flushConversation(conversationId, hooks) {
    const pending = Object.values(get().entries)
      .filter((e) => e.conversationId === conversationId)
      .filter((e) => e.status === "pending" || e.status === "failed")
      .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const entry of pending) {
      if (get().flushing.has(entry.clientOpId)) continue;
      const attempts = entry.attempts + 1;
      if (entry.status === "failed" && attempts > 1) {
        await new Promise<void>((r) => {
          setTimeout(r, delayForAttempt(attempts));
        });
      }
      set((s) => {
        const flushing = new Set(s.flushing);
        flushing.add(entry.clientOpId);
        return {
          flushing,
          entries: patchEntry(s.entries, entry.clientOpId, {
            status: "sending",
            attempts,
          }),
        };
      });

      const result = await flushOneEntry(entry, hooks);

      set((s) => {
        const flushing = new Set(s.flushing);
        flushing.delete(entry.clientOpId);
        return { flushing };
      });

      if (result === "done") {
        set((s) => {
          const next = { ...s.entries };
          delete next[entry.clientOpId];
          return { entries: next };
        });
        continue;
      }
      if (result === "stale") {
        get().setEntryStatus(entry.clientOpId, "stale");
        break;
      }
      get().setEntryStatus(entry.clientOpId, "failed", "send failed");
    }
  },

  async flushAll(hooks) {
    const conversationIds = [...new Set(Object.values(get().entries).map((e) => e.conversationId))];
    for (const conversationId of conversationIds) {
      await get().flushConversation(conversationId, hooks);
    }
  },
}));
