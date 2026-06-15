import type { DisplayItem, SessionListItem } from "@freeanima/platform/connectors/webui/api";
import { hasNewAssistantReply } from "@freeanima/platform/connectors/webui/display-recovery";
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
  patchStudioConfig,
} from "@/lib/api.ts";
import {
  resolvePairProgrammingSatelliteBase,
  satelliteCreateSession,
  satelliteGetSessionMessages,
  satelliteGetStudioConfig,
  satelliteGetStudioFile,
  satelliteGetStudioTree,
  satelliteListSessions,
  satellitePatchStudioConfig,
  satelliteSearchStudio,
  satelliteSetSessionTitle,
} from "@/lib/pair-programming-satellite.ts";

export const STUDIO_PAIR_PLATFORM = "studio-pair-programming";

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
  satelliteBase: string | null;
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
  initSatellite: () => Promise<string | null>;
  fetchConfig: () => Promise<void>;
  saveWorkspace: (workspace: string) => Promise<void>;
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
  satelliteBase: null,
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

  async initSatellite() {
    const base = await resolvePairProgrammingSatelliteBase();
    set({ satelliteBase: base });
    return base;
  },

  async fetchConfig() {
    try {
      const base = get().satelliteBase ?? (await get().initSatellite());
      const cfg = base
        ? ((await satelliteGetStudioConfig(base)) as StudioConfig)
        : ((await getStudioConfig()) as StudioConfig);
      set({ config: cfg, workspace: cfg.workspace || "" });
    } catch (e) {
      console.error("fetchConfig:", e);
    }
  },

  async saveWorkspace(workspace) {
    const ws = workspace.trim();
    if (!ws) return;
    const base = get().satelliteBase ?? (await get().initSatellite());
    if (base) {
      await satellitePatchStudioConfig(base, { workspace: ws });
    } else {
      await patchStudioConfig({ workspace: ws });
    }
    await get().fetchConfig();
    await get().fetchTree();
  },

  async fetchSessions() {
    try {
      const base = get().satelliteBase ?? (await get().initSatellite());
      const resp = base
        ? await satelliteListSessions(base, STUDIO_PAIR_PLATFORM)
        : await listSessions(STUDIO_PAIR_PLATFORM);
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
      const base = get().satelliteBase ?? (await get().initSatellite());
      const resp = base
        ? await satelliteGetSessionMessages(base, id)
        : await getSessionMessages(id);
      set({ display: (resp as { display?: DisplayItem[] }).display ?? [] });
    } catch (e) {
      console.error("selectSession:", e);
    }
  },

  async createNewSession() {
    try {
      const base = get().satelliteBase ?? (await get().initSatellite());
      const d = base
        ? await satelliteCreateSession(base, STUDIO_PAIR_PLATFORM)
        : await createSession(STUDIO_PAIR_PLATFORM);
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
      const base = get().satelliteBase ?? (await get().initSatellite());
      if (base) {
        await satelliteSetSessionTitle(base, sessionId, newTitle);
      } else {
        await setSessionTitle(sessionId, newTitle);
      }
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
      const base = get().satelliteBase ?? (await get().initSatellite());
      const resp = base
        ? await satelliteGetSessionMessages(base, sessionId)
        : await getSessionMessages(sessionId);
      const display = (resp as { display?: DisplayItem[] }).display ?? [];
      set({ display });
      return hasNewAssistantReply(display, baselineCount);
    } catch (e) {
      console.error("refreshMessages:", e);
      return false;
    }
  },

  async fetchTree() {
    set({ loading: true, error: "" });
    try {
      const base = get().satelliteBase ?? (await get().initSatellite());
      const d = base
        ? ((await satelliteGetStudioTree(base)) as { tree?: FileTreeNode[]; workspace?: string })
        : ((await getStudioTree()) as { tree?: FileTreeNode[]; workspace?: string });
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
      const base = get().satelliteBase ?? (await get().initSatellite());
      const file = base ? await satelliteGetStudioFile(base, path) : await getStudioFile(path);
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
      const base = get().satelliteBase ?? (await get().initSatellite());
      const d = base ? await satelliteSearchStudio(base, query) : await searchStudio(query);
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
