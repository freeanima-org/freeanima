import type { DisplayItem, ConversationListItem } from "@pair/lib/types.ts";
import { hasNewAssistantReply } from "@pair/lib/display-recovery.ts";
import { create } from "zustand";
import {
  createConversation,
  getStoredMessages,
  getStudioConfig,
  getStudioFile,
  getStudioTree,
  listConversations,
  searchStudio,
  setConversationTitle,
} from "@pair/lib/api.ts";
import { pairPlatform } from "@pair/lib/sap-client.ts";

export { STUDIO_PAIR_PLATFORM } from "@pair/lib/sap-client.ts";

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
  conversations: ConversationListItem[];
  currentConversationId: string | null;
  display: DisplayItem[];
  fileTree: FileTreeNode[];
  currentFile: StudioFileView | null;
  searchResults: SearchHit[];
  workspace: string;
  config: StudioConfig;
  loading: boolean;
  error: string;
  fetchConfig: () => Promise<void>;
  fetchConversations: () => Promise<ConversationListItem[]>;
  selectConversation: (id: string) => Promise<void>;
  createNewConversation: () => Promise<string | null>;
  renameConversation: (conversationId: string, newTitle: string) => Promise<void>;
  appendItem: (item: DisplayItem) => void;
  refreshMessages: (conversationId: string, baselineCount: number) => Promise<boolean>;
  fetchTree: () => Promise<void>;
  openFile: (path: string, highlightLine?: number) => Promise<void>;
  globalSearch: (query: string) => Promise<void>;
  clearError: () => void;
};

export const usePairProgrammingStore = create<PairProgrammingState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
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

  async fetchConversations() {
    try {
      const resp = await listConversations(await pairPlatform());
      const conversations = (resp.conversations ?? []) as ConversationListItem[];
      set({ conversations });
      return conversations;
    } catch (e) {
      console.error("fetchSessions:", e);
      return [];
    }
  },

  async selectConversation(id) {
    set({ currentConversationId: id, display: [] });
    try {
      const resp = await getStoredMessages(id);
      set({ display: (resp.display as DisplayItem[] | undefined) ?? [] });
    } catch (e) {
      console.error("selectSession:", e);
    }
  },

  async createNewConversation() {
    try {
      const d = await createConversation(await pairPlatform());
      await get().fetchConversations();
      const conversationId = d.conversation_id;
      await get().selectConversation(conversationId);
      return conversationId;
    } catch (e) {
      console.error("createNewConversation:", e);
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

  async refreshMessages(conversationId, baselineCount) {
    try {
      const resp = await getStoredMessages(conversationId);
      const display = (resp.display as DisplayItem[] | undefined) ?? [];
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
      set({ searchResults: ((d.results as SearchHit[] | undefined) || []) as SearchHit[] });
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
