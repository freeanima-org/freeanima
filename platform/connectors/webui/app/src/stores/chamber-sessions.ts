import { create } from "zustand";
import type { DisplayItem, SessionListItem } from "@freeanima/platform/connectors/webui/api";
import { getSessionInfo, getSessionMessages, listSessions } from "@/lib/api.ts";

const SESSIONS_PAGE_SIZE = 10;
const MESSAGES_PAGE_SIZE = 100;
const SESSIONS_CACHE_TTL_MS = 30_000;

type ChamberSessionsState = {
  sessions: SessionListItem[];
  sessionsTotal: number;
  sessionsPage: number;
  sessionsFetchedAt: number;
  selectedId: string | null;
  headlineById: Record<string, SessionListItem>;
  display: DisplayItem[];
  total: number;
  offset: number;
  limit: number;
  loadingSessions: boolean;
  loadingMessages: boolean;
  error: string;
  sessionsPageCount: () => number;
  currentSessionsPage: () => number;
  goToSessionsPage: (page: number) => Promise<void>;
  pageCount: () => number;
  currentPage: () => number;
  findSession: (id: string) => SessionListItem | undefined;
  fetchSessions: (opts?: { force?: boolean; page?: number }) => Promise<void>;
  ensureSessionHeadline: (id: string) => Promise<void>;
  selectSession: (id: string, page?: number) => Promise<void>;
  goToPage: (page: number) => Promise<void>;
};

export const useChamberSessionsStore = create<ChamberSessionsState>((set, get) => ({
  sessions: [],
  sessionsTotal: 0,
  sessionsPage: 1,
  sessionsFetchedAt: 0,
  selectedId: null,
  headlineById: {},
  display: [],
  total: 0,
  offset: 0,
  limit: MESSAGES_PAGE_SIZE,
  loadingSessions: false,
  loadingMessages: false,
  error: "",

  sessionsPageCount() {
    const { sessionsTotal } = get();
    return sessionsTotal > 0 ? Math.ceil(sessionsTotal / SESSIONS_PAGE_SIZE) : 1;
  },

  currentSessionsPage() {
    return get().sessionsPage;
  },

  async goToSessionsPage(page) {
    const safe = Math.min(Math.max(1, page), get().sessionsPageCount());
    if (safe === get().sessionsPage) return;
    await get().fetchSessions({ page: safe, force: true });
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
    return get().sessions.find((s) => s.id === id) ?? get().headlineById[id] ?? undefined;
  },

  async fetchSessions(opts) {
    const state = get();
    const page = opts?.page ?? state.sessionsPage;
    const force = opts?.force ?? false;
    if (
      !force &&
      state.sessions.length > 0 &&
      page === state.sessionsPage &&
      Date.now() - state.sessionsFetchedAt < SESSIONS_CACHE_TTL_MS
    ) {
      return;
    }
    set({ loadingSessions: true, error: "" });
    const offset = (page - 1) * SESSIONS_PAGE_SIZE;
    try {
      const resp = await listSessions({ offset, limit: SESSIONS_PAGE_SIZE });
      const sessions = (resp as { sessions?: SessionListItem[] }).sessions ?? [];
      const total = (resp as { total?: number }).total ?? sessions.length;
      set({
        sessions,
        sessionsTotal: total,
        sessionsPage: page,
        sessionsFetchedAt: Date.now(),
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        sessions: [],
        sessionsTotal: 0,
        sessionsPage: 1,
        sessionsFetchedAt: 0,
      });
    } finally {
      set({ loadingSessions: false });
    }
  },

  async ensureSessionHeadline(id) {
    if (get().findSession(id)) return;
    try {
      const info = (await getSessionInfo(id)) as {
        session_id?: string;
        title?: string;
        platform?: string;
        created?: string;
      };
      const item: SessionListItem = {
        id: info.session_id ?? id,
        title: info.title ?? "",
        platform: info.platform ?? "",
        created: info.created ?? "",
      };
      set((state) => ({
        headlineById: { ...state.headlineById, [id]: item },
      }));
    } catch {
      /* headline optional */
    }
  },

  async selectSession(id, page = 1) {
    const state = get();
    if (state.selectedId === id && page === state.currentPage() && state.display.length) return;
    set({ selectedId: id, error: "" });
    await get().ensureSessionHeadline(id);
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
