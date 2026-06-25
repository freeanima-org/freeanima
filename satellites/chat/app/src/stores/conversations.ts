import type { DisplayItem, ConversationListItem } from "@chat/lib/types.ts";
import { hasNewAssistantReply } from "@chat/lib/display-recovery.ts";
import { create } from "zustand";
import {
  createConversation,
  getStoredMessages,
  listConversations,
  setConversationTitle,
} from "@chat/lib/api.ts";

type ConversationsState = {
  conversations: ConversationListItem[];
  currentId: string | null;
  display: DisplayItem[];
  loading: boolean;
  fetchConversations: () => Promise<ConversationListItem[]>;
  selectConversation: (id: string) => Promise<void>;
  newConversation: () => Promise<string | null>;
  renameConversation: (conversationId: string, newTitle: string) => Promise<void>;
  appendItem: (item: DisplayItem) => void;
  appendItemForConversation: (conversationId: string, item: DisplayItem) => void;
  refreshMessages: (conversationId: string, baselineCount: number) => Promise<boolean>;
  reloadConversationIfCurrent: (conversationId: string) => Promise<void>;
  patchProgressLine: (text: string, messageId?: string) => void;
};

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  conversations: [],
  currentId: null,
  display: [],
  loading: false,

  async fetchConversations() {
    try {
      const resp = await listConversations();
      set({ conversations: resp.conversations });
      return resp.conversations;
    } catch (e) {
      console.error("fetchSessions:", e);
      return [];
    }
  },

  async selectConversation(id) {
    set({ currentId: id, loading: true });
    try {
      const resp = await getStoredMessages(id);
      set({ display: (resp as { display?: DisplayItem[] }).display ?? [], loading: false });
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

  appendItem(item) {
    set({ display: [...get().display, item] });
  },

  appendItemForConversation(conversationId, item) {
    if (get().currentId !== conversationId) return;
    set({ display: [...get().display, item] });
  },

  async refreshMessages(conversationId, baselineCount) {
    try {
      const resp = await getStoredMessages(conversationId);
      const display = (resp as { display?: DisplayItem[] }).display ?? [];
      const hasReply = hasNewAssistantReply(display, baselineCount);
      if (get().currentId === conversationId) {
        set({ display });
      }
      return hasReply;
    } catch (e) {
      console.error("refreshMessages:", e);
      return false;
    }
  },

  async reloadConversationIfCurrent(conversationId) {
    if (get().currentId !== conversationId) return;
    try {
      const resp = await getStoredMessages(conversationId);
      set({ display: (resp as { display?: DisplayItem[] }).display ?? [] });
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
