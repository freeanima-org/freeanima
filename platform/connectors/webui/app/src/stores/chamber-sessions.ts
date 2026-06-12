import type { DisplayItem, SessionListItem } from "@freeanima/platform/connectors/webui/api";
import { create } from "zustand";
import { getSessionMessages, listAllSessions } from "@/lib/api.ts";

const SESSIONS_PAGE_SIZE = 10;
const MESSAGES_PAGE_SIZE = 100;

type ChamberSessionsState = {
  sessions: SessionListItem[];
  sessionsPage: number;
  selectedId: string | null;
  display: DisplayItem[];
  total: number;
  offset: number;
  limit: number;
  loadingSessions: boolean;
  loadingMessages: boolean;
  error: string;
  sortedSessions: () => SessionListItem[];
  paginatedSessions: () => SessionListItem[];
  sessionsPageCount: () => number;
  currentSessionsPage: () => number;
  goToSessionsPage: (page: number) => void;
  pageCount: () => number;
  currentPage: () => number;
  findSession: (id: string) => SessionListItem | undefined;
  fetchSessions: () => Promise<void>;
  selectSession: (id: string, page?: number) => Promise<void>;
  goToPage: (page: number) => Promise<void>;
};

export const useChamberSessionsStore = create<ChamberSessionsState>((set, get) => ({
  sessions: [],
  sessionsPage: 1,
  selectedId: null,
  display: [],
  total: 0,
  offset: 0,
  limit: MESSAGES_PAGE_SIZE,
  loadingSessions: false,
  loadingMessages: false,
  error: "",

  sortedSessions() {
    return [...get().sessions].toSorted((a, b) => (b.created || "").localeCompare(a.created || ""));
  },

  paginatedSessions() {
    const { sessionsPage } = get();
    const sorted = get().sortedSessions();
    const start = (sessionsPage - 1) * SESSIONS_PAGE_SIZE;
    return sorted.slice(start, start + SESSIONS_PAGE_SIZE);
  },

  sessionsPageCount() {
    const total = get().sortedSessions().length;
    return total > 0 ? Math.ceil(total / SESSIONS_PAGE_SIZE) : 1;
  },

  currentSessionsPage() {
    return get().sessionsPage;
  },

  goToSessionsPage(page) {
    const safe = Math.min(Math.max(1, page), get().sessionsPageCount());
    set({ sessionsPage: safe });
  },

  pageCount() {
    const { limit, total } = get();
    return limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  },

  currentPage() {
    const { limit, offset } = get();
    return limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  },

  findSession(id) {
    return get().sessions.find((s) => s.id === id);
  },

  async fetchSessions() {
    set({ loadingSessions: true, error: "" });
    try {
      const resp = await listAllSessions();
      const sessions = (resp as { sessions?: SessionListItem[] }).sessions ?? [];
      set({ sessions, sessionsPage: 1 });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        sessions: [],
        sessionsPage: 1,
      });
    } finally {
      set({ loadingSessions: false });
    }
  },

  async selectSession(id, page = 1) {
    const state = get();
    if (state.selectedId === id && page === state.currentPage() && state.display.length) return;
    set({ selectedId: id, error: "" });
    await get().goToPage(page);
  },

  async goToPage(page) {
    const sessionId = get().selectedId;
    if (!sessionId) return;
    set({ loadingMessages: true, error: "" });
    const { limit } = get();
    const safe = Math.min(Math.max(1, page), get().pageCount());
    const pageOffset = Math.max(0, (safe - 1) * limit);
    try {
      const data = await getSessionMessages(sessionId, pageOffset, limit);
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
