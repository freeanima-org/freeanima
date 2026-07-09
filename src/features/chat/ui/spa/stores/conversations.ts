import type {
  DisplayItem,
  ConversationListItem,
} from "@freeanima/features/chat/ui/spa/lib/types.ts";
import { hasNewAssistantReply } from "@freeanima/features/chat/ui/spa/lib/display-recovery.ts";
import { create } from "zustand";
import {
  archiveConversation as archiveConversationApi,
  createConversation,
  deleteConversation as deleteConversationApi,
  getStoredMessages,
  interruptMessageStream,
  listConversations,
  setConversationTitle,
  unarchiveConversation as unarchiveConversationApi,
} from "@freeanima/features/chat/ui/spa/lib/api.ts";
import {
  readCachedConversations,
  readCachedMessages,
  resolveHubCacheScope,
  writeCachedConversations,
  writeCachedMessages,
} from "@freeanima/features/chat/ui/spa/lib/offline-cache.ts";
import { getConversationTail } from "@freeanima/features/chat/ui/spa/lib/api.ts";
import { sortConversationsByUpdatedAt } from "@freeanima/features/chat/ui/spa/lib/sort-conversations.ts";
import { useChatStore } from "@freeanima/features/chat/ui/spa/stores/chat.ts";

type ConversationsState = {
  conversations: ConversationListItem[];
  currentId: string | null;
  display: DisplayItem[];
  loading: boolean;
  showArchived: boolean;
  tailPosByConversation: Record<string, number>;
  fetchConversations: () => Promise<ConversationListItem[]>;
  setShowArchived: (show: boolean) => Promise<ConversationListItem[]>;
  selectConversation: (id: string) => Promise<void>;
  newConversation: () => Promise<string | null>;
  renameConversation: (conversationId: string, newTitle: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<string | null>;
  unarchiveConversation: (conversationId: string) => Promise<string | null>;
  deleteConversation: (conversationId: string) => Promise<string | null>;
  appendItem: (item: DisplayItem) => void;
  appendItemForConversation: (conversationId: string, item: DisplayItem) => void;
  patchDisplayByClientOpId: (
    clientOpId: string,
    patch: Partial<Pick<DisplayItem & { type: "message" }, "sendStatus" | "content">>,
  ) => void;
  removeDisplayByClientOpId: (clientOpId: string) => void;
  refreshMessages: (conversationId: string, baselineCount: number) => Promise<boolean>;
  reloadConversationIfCurrent: (conversationId: string) => Promise<void>;
  patchProgressLine: (text: string, messageId?: string) => void;
  cacheTailPos: (conversationId: string, tailPos: number) => void;
  resolveExpectedTailPos: (conversationId: string, online: boolean) => Promise<number>;
};

async function maybeInterruptStream(conversationId: string): Promise<void> {
  const { streaming, streamingConversationId } = useChatStore.getState();
  if (streaming && streamingConversationId === conversationId) {
    await interruptMessageStream(conversationId);
  }
}

function activeConversations(conversations: ConversationListItem[]): ConversationListItem[] {
  return conversations.filter((c) => !c.archivedAt);
}

async function navigateAfterRemove(
  get: () => ConversationsState,
  removedId: string,
): Promise<string | null> {
  if (get().currentId !== removedId) return get().currentId;
  const remaining = activeConversations(get().conversations);
  if (remaining.length > 0) {
    const first = remaining[0];
    if (first) {
      await get().selectConversation(first.id);
      return first.id;
    }
  }
  const newId = await get().newConversation();
  return newId;
}

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  conversations: [],
  currentId: null,
  display: [],
  loading: false,
  showArchived: false,
  tailPosByConversation: {},

  cacheTailPos(conversationId, tailPos) {
    set((s) => ({
      tailPosByConversation: { ...s.tailPosByConversation, [conversationId]: tailPos },
    }));
  },

  async resolveExpectedTailPos(conversationId, online) {
    if (online) {
      try {
        const tail = await getConversationTail(conversationId);
        get().cacheTailPos(conversationId, tail.tail_pos);
        return tail.tail_pos;
      } catch {
        // fall through to cache
      }
    }
    return get().tailPosByConversation[conversationId] ?? 0;
  },

  async fetchConversations() {
    const scope = resolveHubCacheScope();
    const includeArchived = get().showArchived;
    const cached = await readCachedConversations(scope, includeArchived);
    if (cached?.length) {
      set({ conversations: sortConversationsByUpdatedAt(cached) });
    }
    try {
      const resp = await listConversations({ includeArchived });
      const conversations = sortConversationsByUpdatedAt(resp.conversations);
      set({ conversations });
      void writeCachedConversations(scope, includeArchived, conversations);
      return conversations;
    } catch (e) {
      console.error("fetchSessions:", e);
      return cached ?? [];
    }
  },

  async setShowArchived(show) {
    set({ showArchived: show });
    return get().fetchConversations();
  },

  async selectConversation(id) {
    set({ currentId: id, loading: true });
    const scope = resolveHubCacheScope();
    const cached = await readCachedMessages(scope, id);
    if (cached) {
      set({ display: cached });
    }
    try {
      const resp = await getStoredMessages(id);
      const display = (resp as { display?: DisplayItem[] }).display ?? [];
      set({ display, loading: false });
      void writeCachedMessages(scope, id, display);
      void get().resolveExpectedTailPos(id, true);
    } catch (e) {
      console.error("selectSession messages:", e);
      set({ loading: false });
    }
  },

  async newConversation() {
    try {
      const d = await createConversation();
      await get().fetchConversations();
      const conversationId = d.conversation_id;
      await get().selectConversation(conversationId);
      return conversationId;
    } catch (e) {
      console.error("newConversation:", e);
      return null;
    }
  },

  async renameConversation(conversationId, newTitle) {
    try {
      await setConversationTitle(conversationId, newTitle);
      set({
        conversations: get().conversations.map((s) =>
          s.id === conversationId ? { ...s, title: newTitle } : s,
        ),
      });
    } catch (e) {
      console.error("renameSession:", e);
    }
  },

  async archiveConversation(conversationId) {
    try {
      await maybeInterruptStream(conversationId);
      await archiveConversationApi(conversationId);
      await get().fetchConversations();
      return navigateAfterRemove(get, conversationId);
    } catch (e) {
      console.error("archiveConversation:", e);
      return get().currentId;
    }
  },

  async unarchiveConversation(conversationId) {
    try {
      await unarchiveConversationApi(conversationId);
      await get().fetchConversations();
      return get().currentId;
    } catch (e) {
      console.error("unarchiveConversation:", e);
      return get().currentId;
    }
  },

  async deleteConversation(conversationId) {
    try {
      await maybeInterruptStream(conversationId);
      await deleteConversationApi(conversationId);
      await get().fetchConversations();
      return navigateAfterRemove(get, conversationId);
    } catch (e) {
      console.error("deleteConversation:", e);
      return get().currentId;
    }
  },

  appendItem(item) {
    set({ display: [...get().display, item] });
  },

  appendItemForConversation(conversationId, item) {
    if (get().currentId !== conversationId) return;
    set({ display: [...get().display, item] });
  },

  patchDisplayByClientOpId(clientOpId, patch) {
    set((s) => ({
      display: s.display.map((item) => {
        if (item.type !== "message" || item.clientOpId !== clientOpId) return item;
        return { ...item, ...patch };
      }),
    }));
  },

  removeDisplayByClientOpId(clientOpId) {
    set((s) => ({
      display: s.display.filter(
        (item) => !(item.type === "message" && item.clientOpId === clientOpId),
      ),
    }));
  },

  async refreshMessages(conversationId, baselineCount) {
    const scope = resolveHubCacheScope();
    try {
      const resp = await getStoredMessages(conversationId);
      const display = (resp as { display?: DisplayItem[] }).display ?? [];
      const hasReply = hasNewAssistantReply(display, baselineCount);
      if (get().currentId === conversationId) {
        set({ display });
      }
      void writeCachedMessages(scope, conversationId, display);
      void get().resolveExpectedTailPos(conversationId, true);
      return hasReply;
    } catch (e) {
      console.error("refreshMessages:", e);
      return false;
    }
  },

  async reloadConversationIfCurrent(conversationId) {
    if (get().currentId !== conversationId) return;
    const scope = resolveHubCacheScope();
    try {
      const resp = await getStoredMessages(conversationId);
      const display = (resp as { display?: DisplayItem[] }).display ?? [];
      set({ display });
      void writeCachedMessages(scope, conversationId, display);
      void get().resolveExpectedTailPos(conversationId, true);
    } catch (e) {
      console.error("reloadSessionIfCurrent:", e);
    }
  },

  patchProgressLine(text: string) {
    const display = [...get().display];
    for (let i = display.length - 1; i >= 0; i--) {
      const item = display[i];
      if (
        item?.type === "message" &&
        item.role === "assistant" &&
        item.content.includes("Cursor working")
      ) {
        display[i] = { ...item, content: text };
        set({ display });
        return;
      }
    }
  },
}));
