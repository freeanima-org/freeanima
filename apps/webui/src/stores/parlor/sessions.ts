import { defineStore } from "pinia";
import { ref } from "vue";
import type { SessionListItem } from "@freeanima/legacy-api";
import {
  listSessions,
  createSession,
  getMessages,
  setSessionTitle,
} from "../../api/client";

export const useSessionsStore = defineStore("sessions", () => {
  const sessions = ref<SessionListItem[]>([]);
  const currentId = ref<string | null>(null);
  const display = ref<any[]>([]);
  const loading = ref(false);

  async function fetchSessions() {
    try {
      sessions.value = await listSessions();
      return sessions.value;
    } catch (e) {
      console.error("fetchSessions:", e);
      return [];
    }
  }

  async function selectSession(id: string) {
    currentId.value = id;
    display.value = [];
    try {
      const d = await getMessages(id);
      display.value = (d.display || []) as Record<string, unknown>[];
    } catch (e) {
      console.error("selectSession messages:", e);
    }
  }

  async function newSession() {
    try {
      const d = await createSession();
      await fetchSessions();
      await selectSession(d.session_id);
      return d.session_id;
    } catch (e) {
      console.error("newSession:", e);
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

  function appendItem(item: unknown) {
    display.value.push(item as Record<string, unknown>);
  }

  return {
    sessions,
    currentId,
    display,
    loading,
    fetchSessions,
    selectSession,
    newSession,
    renameSession,
    appendItem,
  };
});
