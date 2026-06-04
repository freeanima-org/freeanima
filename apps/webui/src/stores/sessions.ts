import type { DisplayItem, SessionListItem } from "@freeanima/legacy-api";
import { create } from "zustand";
import { trpc } from "@/lib/trpc";

export const PARLOR_PLATFORM = "parlor";

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
};

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  currentId: null,
  display: [],
  loading: false,

  async fetchSessions() {
    try {
      const resp = await trpc.sessions.list.query({ platform: PARLOR_PLATFORM });
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
      const resp = await trpc.sessions.messages.query({ sessionId: id });
      set({ display: (resp as { display?: DisplayItem[] }).display ?? [] });
    } catch (e) {
      console.error("selectSession messages:", e);
    }
  },

  async newSession() {
    try {
      const d = await trpc.sessions.create.mutate({ platform: PARLOR_PLATFORM });
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
      await trpc.sessions.setTitle.mutate({ sessionId, title: newTitle });
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
}));
