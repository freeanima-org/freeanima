import { create } from "zustand";
import type { DisplayItem, ConversationListItem } from "@freeanima/admin-api/api";
import { getConversationInfo, getStoredMessages, listConversations } from "@admin/lib/api.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";

const CONVERSATIONS_PAGE_SIZE = 10;
const MESSAGES_PAGE_SIZE = 100;
const CONVERSATIONS_CACHE_TTL_MS = 30_000;

type AdminConversationsState = {
  conversations: ConversationListItem[];
  conversationsTotal: number;
  conversationsPage: number;
  conversationsFetchedAt: number;
  selectedId: string | null;
  headlineById: Record<string, ConversationListItem>;
  display: DisplayItem[];
  total: number;
  offset: number;
  limit: number;
  loadingConversations: boolean;
  loadingMessages: boolean;
  error: string;
  conversationsPageCount: () => number;
  currentConversationsPage: () => number;
  goToConversationsPage: (page: number) => Promise<void>;
  pageCount: () => number;
  currentPage: () => number;
  findConversation: (id: string) => ConversationListItem | undefined;
  fetchConversations: (opts?: { force?: boolean; page?: number }) => Promise<void>;
  ensureConversationHeadline: (id: string) => Promise<void>;
  selectConversation: (id: string, page?: number) => Promise<void>;
  goToPage: (page: number) => Promise<void>;
};

export const useAdminConversationsStore = create<AdminConversationsState>((set, get) => ({
  conversations: [],
  conversationsTotal: 0,
  conversationsPage: 1,
  conversationsFetchedAt: 0,
  selectedId: null,
  headlineById: {},
  display: [],
  total: 0,
  offset: 0,
  limit: MESSAGES_PAGE_SIZE,
  loadingConversations: false,
  loadingMessages: false,
  error: "",

  conversationsPageCount() {
    const { conversationsTotal } = get();
    return conversationsTotal > 0 ? Math.ceil(conversationsTotal / CONVERSATIONS_PAGE_SIZE) : 1;
  },

  currentConversationsPage() {
    return get().conversationsPage;
  },

  async goToConversationsPage(page) {
    const safe = Math.min(Math.max(1, page), get().conversationsPageCount());
    if (safe === get().conversationsPage) return;
    await get().fetchConversations({ page: safe, force: true });
  },

  pageCount() {
    const { limit, total } = get();
    return limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  },

  currentPage() {
    const { limit, offset } = get();
    return limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  },

  findConversation(id) {
    return get().conversations.find((s) => s.id === id) ?? get().headlineById[id] ?? undefined;
  },

  async fetchConversations(opts) {
    const state = get();
    const page = opts?.page ?? state.conversationsPage;
    const force = opts?.force ?? false;
    if (
      !force &&
      state.conversations.length > 0 &&
      page === state.conversationsPage &&
      Date.now() - state.conversationsFetchedAt < CONVERSATIONS_CACHE_TTL_MS
    ) {
      return;
    }
    set({ loadingConversations: true, error: "" });
    const offset = (page - 1) * CONVERSATIONS_PAGE_SIZE;
    try {
      const resp = await listConversations({ offset, limit: CONVERSATIONS_PAGE_SIZE });
      const conversations =
        (resp as { conversations?: ConversationListItem[] }).conversations ?? [];
      const total = (resp as { total?: number }).total ?? conversations.length;
      set({
        conversations,
        conversationsTotal: total,
        conversationsPage: page,
        conversationsFetchedAt: Date.now(),
      });
    } catch (e) {
      logCaughtError("stores/admin-conversations", e);
      set({
        error: e instanceof Error ? e.message : String(e),
        conversations: [],
        conversationsTotal: 0,
        conversationsPage: 1,
        conversationsFetchedAt: 0,
      });
    } finally {
      set({ loadingConversations: false });
    }
  },

  async ensureConversationHeadline(id) {
    if (get().findConversation(id)) return;
    try {
      const info = (await getConversationInfo(id)) as {
        conversation_id?: string;
        title?: string;
        platform?: string;
        created?: string;
      };
      const item: ConversationListItem = {
        id: info.conversation_id ?? id,
        title: info.title ?? "",
        platform: info.platform ?? "",
        created: info.created ?? "",
      };
      set((state) => ({
        headlineById: { ...state.headlineById, [id]: item },
      }));
    } catch (err) {
      logCaughtError("stores/admin-conversations/fetchHeadline", err);
      /* headline optional */
    }
  },

  async selectConversation(id, page = 1) {
    const state = get();
    if (state.selectedId === id && page === state.currentPage() && state.display.length) return;
    set({ selectedId: id, error: "" });
    await get().ensureConversationHeadline(id);
    await get().goToPage(page);
  },

  async goToPage(page) {
    const conversationId = get().selectedId;
    if (!conversationId) return;
    set({ loadingMessages: true, error: "" });
    const { limit } = get();
    const safe = Math.min(Math.max(1, page), get().pageCount());
    const pageOffset = Math.max(0, (safe - 1) * limit);
    try {
      const data = await getStoredMessages(conversationId, pageOffset, limit);
      const resp = data as {
        display?: DisplayItem[];
        total?: number;
        offset?: number;
        limit?: number;
      };
      set({
        display: resp.display ?? [],
        total: resp.total ?? resp.display?.length ?? 0,
        offset: resp.offset ?? pageOffset,
        limit: resp.limit ?? limit,
      });
    } catch (e) {
      logCaughtError("stores/admin-conversations", e);
      set({
        error: e instanceof Error ? e.message : String(e),
        display: [],
        total: 0,
      });
    } finally {
      set({ loadingMessages: false });
    }
  },
}));
