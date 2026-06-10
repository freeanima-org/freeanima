import type { DisplayItem, SessionListItem } from "@freeanima/connectors-webui/api";
import { create } from "zustand";
import {
  createSession,
  getSessionMessages,
  getStudioConfig,
  getStudioFile,
  getStudioTree,
  listSessions,
  searchStudio,
  setSessionTitle,
} from "@/lib/api.ts";

export const STUDIO_PAIR_PLATFORM = "studio-pair-programming";

function hasNewReply(display: DisplayItem[], baselineCount: number): boolean {
  const newItems = display.slice(baselineCount);
  return newItems.some(
    (item) => (item.type === "message" && item.role === "assistant") || item.type === "tool_block",
  );
}

export type StudioFileView = Record<string, unknown> & { highlightLine?: number | null };

type StudioConfig = {
  workspace: string;
  gitignore: boolean;
  showHidden: boolean;
};

type FileTreeNode = Record<string, unknown>;

type SearchHit = {
  path?: string;
  file?: string;
  line?: number;
  preview?: string;
  content?: string;
};

type PairProgrammingState = {
  sessions: SessionListItem[];
  currentSessionId: string | null;
  display: DisplayItem[];
  fileTree: FileTreeNode[];
  currentFile: StudioFileView | null;
  searchResults: SearchHit[];
  workspace: string;
  config: StudioConfig;
  loading: boolean;
  error: string;
  fetchConfig: () => Promise<void>;
  fetchSessions: () => Promise<SessionListItem[]>;
  selectSession: (id: string) => Promise<void>;
  createNewSession: () => Promise<string | null>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
  appendItem: (item: DisplayItem) => void;
  refreshMessages: (sessionId: string, baselineCount: number) => Promise<boolean>;
  fetchTree: () => Promise<void>;
  openFile: (path: string, highlightLine?: number) => Promise<void>;
  globalSearch: (query: string) => Promise<void>;
  clearError: () => void;
};

export const usePairProgrammingStore = create<PairProgrammingState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  display: [],
  fileTree: [],
  currentFile: null,
  searchResults: [],
  workspace: "",
  config: { workspace: "", gitignore: true, showHidden: false },
  loading: false,
  error: "",

  async fetchConfig() {
    try {
      const cfg = (await getStudioConfig()) as StudioConfig;
      set({ config: cfg, workspace: cfg.workspace || "" });
    } catch (e) {
      console.error("fetchConfig:", e);
    }
  },

  async fetchSessions() {
    try {
      const resp = await listSessions(STUDIO_PAIR_PLATFORM);
      const sessions = (resp as { sessions?: SessionListItem[] }).sessions ?? [];
      set({ sessions });
      return sessions;
    } catch (e) {
      console.error("fetchSessions:", e);
      return [];
    }
  },

  async selectSession(id) {
    set({ currentSessionId: id, display: [] });
    try {
      const resp = await getSessionMessages(id);
      set({ display: (resp as { display?: DisplayItem[] }).display ?? [] });
    } catch (e) {
      console.error("selectSession:", e);
    }
  },

  async createNewSession() {
    try {
      const d = await createSession(STUDIO_PAIR_PLATFORM);
      await get().fetchSessions();
      const sessionId = (d as { session_id: string }).session_id;
      await get().selectSession(sessionId);
      return sessionId;
    } catch (e) {
      console.error("createNewSession:", e);
      return null;
    }
  },

  async renameSession(sessionId, newTitle) {
    try {
      await setSessionTitle(sessionId, newTitle);
      set({
        sessions: get().sessions.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s)),
      });
    } catch (e) {
      console.error("renameSession:", e);
    }
  },

  appendItem(item) {
    set({ display: [...get().display, item] });
  },

  async refreshMessages(sessionId, baselineCount) {
    try {
      const resp = await getSessionMessages(sessionId);
      const display = (resp as { display?: DisplayItem[] }).display ?? [];
      set({ display });
      return hasNewReply(display, baselineCount);
    } catch (e) {
      console.error("refreshMessages:", e);
      return false;
    }
  },

  async fetchTree() {
    set({ loading: true, error: "" });
    try {
      const d = (await getStudioTree()) as { tree?: FileTreeNode[]; workspace?: string };
      set({
        fileTree: d.tree || [],
        workspace: d.workspace || get().workspace,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        fileTree: [],
      });
    } finally {
      set({ loading: false });
    }
  },

  async openFile(path, highlightLine) {
    try {
      const file = await getStudioFile(path);
      set({
        currentFile: {
          ...(file as Record<string, unknown>),
          highlightLine: highlightLine ?? null,
        },
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  async globalSearch(query) {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const d = await searchStudio(query);
      set({ searchResults: ((d as { results?: SearchHit[] }).results || []) as SearchHit[] });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        searchResults: [],
      });
    }
  },

  clearError() {
    set({ error: "" });
  },
}));
