import type { DisplayItem, SessionListItem } from "@freeanima/legacy-api";
import { create } from "zustand";
import { trpc } from "@/lib/trpc";

type ChamberSessionsState = {
  sessions: SessionListItem[];
  selectedId: string | null;
  display: DisplayItem[];
  total: number;
  offset: number;
  limit: number;
  loadingSessions: boolean;
  loadingMessages: boolean;
  error: string;
  sortedSessions: () => SessionListItem[];
  pageCount: () => number;
  currentPage: () => number;
  fetchSessions: () => Promise<void>;
  selectSession: (id: string, page?: number) => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  toggleSession: (id: string) => void;
};

export const useChamberSessionsStore = create<ChamberSessionsState>((set, get) => ({
  sessions: [],
  selectedId: null,
  display: [],
  total: 0,
  offset: 0,
  limit: 100,
  loadingSessions: false,
  loadingMessages: false,
  error: "",

  sortedSessions() {
    return [...get().sessions].toSorted((a, b) => (b.created || "").localeCompare(a.created || ""));
  },

  pageCount() {
    const { limit, total } = get();
    return limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  },

  currentPage() {
    const { limit, offset } = get();
    return limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  },

  async fetchSessions() {
    set({ loadingSessions: true, error: "" });
    try {
      const resp = await trpc.sessions.listAll.query();
      set({ sessions: (resp as { sessions?: SessionListItem[] }).sessions ?? [] });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        sessions: [],
      });
    } finally {
      set({ loadingSessions: false });
    }
  },

  async selectSession(id, page = 1) {
    const state = get();
    if (state.selectedId === id && page === state.currentPage() && state.display.length) return;
    set({ selectedId: id });
    await get().goToPage(page);
  },

  async goToPage(page) {
    const sessionId = get().selectedId;
    if (!sessionId) return;
    set({ loadingMessages: true, error: "" });
    const safe = Math.min(Math.max(1, page), get().pageCount());
    const pageOffset = Math.max(0, (safe - 1) * 100);
    try {
      const data = await trpc.sessions.messages.query({
        sessionId,
        offset: pageOffset,
        limit: 100,
      });
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
        limit: resp.limit ?? 100,
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

  toggleSession(id) {
    if (get().selectedId === id) {
      set({ selectedId: null, display: [], total: 0, offset: 0 });
      return;
    }
    void get().selectSession(id, 1);
  },
}));
