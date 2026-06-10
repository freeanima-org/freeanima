import type { DisplayItem, SessionListItem } from "@freeanima/connectors-webui/api";
import { PARLOR_PLATFORM } from "@freeanima/connectors-webui/api";
import { create } from "zustand";
import { createSession, getSessionMessages, listSessions, setSessionTitle } from "@/lib/api.ts";

export { PARLOR_PLATFORM };

function hasNewReply(display: DisplayItem[], baselineCount: number): boolean {
  const newItems = display.slice(baselineCount);
  return newItems.some(
    (item) => (item.type === "message" && item.role === "assistant") || item.type === "tool_block",
  );
}

type SessionsState = {
  sessions: SessionListItem[];
  currentId: string | null;
  display: DisplayItem[];
  loading: boolean;
  fetchSessions: () => Promise<SessionListItem[]>;
  selectSession: (id: string) => Promise<void>;
  newSession: () => Promise<string | null>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
  appendItem: (item: DisplayItem) => void;
  refreshMessages: (sessionId: string, baselineCount: number) => Promise<boolean>;
};

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  currentId: null,
  display: [],
  loading: false,

  async fetchSessions() {
    try {
      const resp = await listSessions(PARLOR_PLATFORM);
      const sessions = (resp as { sessions?: SessionListItem[] }).sessions ?? [];
      set({ sessions });
      return sessions;
    } catch (e) {
      console.error("fetchSessions:", e);
      return [];
    }
  },

  async selectSession(id) {
    set({ currentId: id, display: [] });
    try {
      const resp = await getSessionMessages(id);
      set({ display: (resp as { display?: DisplayItem[] }).display ?? [] });
    } catch (e) {
      console.error("selectSession messages:", e);
    }
  },

  async newSession() {
    try {
      const d = await createSession(PARLOR_PLATFORM);
      await get().fetchSessions();
      const sessionId = (d as { session_id: string }).session_id;
      await get().selectSession(sessionId);
      return sessionId;
    } catch (e) {
      console.error("newSession:", e);
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
}));
