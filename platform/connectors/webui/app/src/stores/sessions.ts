import type { DisplayItem, SessionListItem } from "@freeanima/platform/connectors/webui/api";
import { PARLOR_PLATFORM } from "@freeanima/platform/connectors/webui/api";
import { hasNewAssistantReply } from "@freeanima/platform/connectors/webui/display-recovery";
import { create } from "zustand";
import { createSession, getSessionMessages, listSessions, setSessionTitle } from "@/lib/api.ts";

export { PARLOR_PLATFORM };

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
  patchProgressLine: (text: string, messageId?: string) => void;
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
      return hasNewAssistantReply(display, baselineCount);
    } catch (e) {
      console.error("refreshMessages:", e);
      return false;
    }
  },

  patchProgressLine(text: string, _messageId?: string) {
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
