import { defineStore } from "pinia";
import { ref } from "vue";
import {
  STUDIO_PAIR_PLATFORM,
  listSessions,
  createSession,
  getMessages,
  setSessionTitle,
  getStudioConfig,
  getStudioTree,
  getStudioFile,
  studioSearch,
} from "../../api/client";

import type { SessionListItem } from "@freeanima/legacy-api";

export const usePairProgrammingStore = defineStore("pair-programming", () => {
  const sessions = ref<SessionListItem[]>([]);
  const currentSessionId = ref<string | null>(null);
  const display = ref<any[]>([]);
  const fileTree = ref<Record<string, unknown>[]>([]);
  const currentFile = ref<Record<string, unknown> | null>(null);
  const searchResults = ref<Record<string, unknown>[]>([]);
  const workspace = ref("");
  const config = ref<{ workspace: string; gitignore: boolean; showHidden: boolean }>({
    workspace: "",
    gitignore: true,
    showHidden: false,
  });
  const loading = ref(false);
  const error = ref("");

  async function fetchConfig() {
    try {
      const c = await getStudioConfig();
      config.value = c as typeof config.value;
      workspace.value = config.value.workspace || "";
    } catch (e) {
      console.error("fetchConfig:", e);
    }
  }

  async function fetchSessions() {
    try {
      sessions.value = await listSessions(STUDIO_PAIR_PLATFORM);
      return sessions.value;
    } catch (e) {
      console.error("fetchSessions:", e);
      return [];
    }
  }

  async function selectSession(id: string) {
    currentSessionId.value = id;
    display.value = [];
    try {
      const d = await getMessages(id);
      display.value = d.display || [];
    } catch (e) {
      console.error("selectSession:", e);
    }
  }

  async function createNewSession() {
    try {
      const d = await createSession(STUDIO_PAIR_PLATFORM);
      await fetchSessions();
      await selectSession(d.session_id);
      return d.session_id;
    } catch (e) {
      console.error("createNewSession:", e);
      return null;
    }
  }

  async function renameSession(sessionId: string, newTitle: string) {
    try {
      await setSessionTitle(sessionId, newTitle);
      const s = sessions.value.find((x) => x.id === sessionId);
      if (s) s.title = newTitle;
    } catch (e) {
      console.error("renameSession:", e);
    }
  }

  function appendItem(item: any) {
    display.value.push(item);
  }

  async function fetchTree() {
    loading.value = true;
    error.value = "";
    try {
      const d = await getStudioTree();
      fileTree.value = (d.tree || []) as Record<string, unknown>[];
      workspace.value = d.workspace || workspace.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      fileTree.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function openFile(path: string, highlightLine?: number) {
    try {
      const f = await getStudioFile(path);
      currentFile.value = { ...(f as Record<string, unknown>), highlightLine: highlightLine || null };
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function globalSearch(query: string) {
    if (!query.trim()) {
      searchResults.value = [];
      return;
    }
    try {
      const d = await studioSearch(query);
      searchResults.value = (d.results || []) as Record<string, unknown>[];
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      searchResults.value = [];
    }
  }

  return {
    sessions,
    currentSessionId,
    display,
    fileTree,
    currentFile,
    searchResults,
    workspace,
    config,
    loading,
    error,
    fetchConfig,
    fetchSessions,
    selectSession,
    createNewSession,
    renameSession,
    appendItem,
    fetchTree,
    openFile,
    globalSearch,
  };
});
