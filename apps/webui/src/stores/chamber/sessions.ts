import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { DisplayItem, SessionListItem } from "@freeanima/legacy-api";
import { getMessages, listAllSessions } from "../../api/client";

export const MESSAGES_PAGE_SIZE = 100;

export const useChamberSessionsStore = defineStore("chamber-sessions", () => {
  const sessions = ref<SessionListItem[]>([]);
  const selectedId = ref<string | null>(null);
  const display = ref<DisplayItem[]>([]);
  const total = ref(0);
  const offset = ref(0);
  const limit = ref(MESSAGES_PAGE_SIZE);
  const loadingSessions = ref(false);
  const loadingMessages = ref(false);
  const error = ref("");

  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => (b.created || "").localeCompare(a.created || "")),
  );

  const pageCount = computed(() =>
    limit.value > 0 ? Math.max(1, Math.ceil(total.value / limit.value)) : 1,
  );

  const currentPage = computed(() =>
    limit.value > 0 ? Math.floor(offset.value / limit.value) + 1 : 1,
  );

  async function fetchSessions() {
    loadingSessions.value = true;
    error.value = "";
    try {
      sessions.value = await listAllSessions();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      sessions.value = [];
    } finally {
      loadingSessions.value = false;
    }
  }

  async function selectSession(id: string, page = 1) {
    if (selectedId.value === id && page === currentPage.value && display.value.length) {
      return;
    }
    selectedId.value = id;
    await loadMessagesPage(id, page);
  }

  async function loadMessagesPage(sessionId: string, page: number) {
    loadingMessages.value = true;
    error.value = "";
    const pageOffset = Math.max(0, (page - 1) * MESSAGES_PAGE_SIZE);
    try {
      const data = await getMessages(sessionId, {
        offset: pageOffset,
        limit: MESSAGES_PAGE_SIZE,
      });
      display.value = data.display ?? [];
      total.value = data.total ?? display.value.length;
      offset.value = data.offset ?? pageOffset;
      limit.value = data.limit ?? MESSAGES_PAGE_SIZE;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      display.value = [];
      total.value = 0;
    } finally {
      loadingMessages.value = false;
    }
  }

  function toggleSession(id: string) {
    if (selectedId.value === id) {
      selectedId.value = null;
      display.value = [];
      total.value = 0;
      offset.value = 0;
      return;
    }
    void selectSession(id, 1);
  }

  async function goToPage(page: number) {
    if (!selectedId.value) return;
    const safe = Math.min(Math.max(1, page), pageCount.value);
    await loadMessagesPage(selectedId.value, safe);
  }

  return {
    sessions,
    sortedSessions,
    selectedId,
    display,
    total,
    offset,
    limit,
    loadingSessions,
    loadingMessages,
    error,
    pageCount,
    currentPage,
    fetchSessions,
    selectSession,
    toggleSession,
    goToPage,
  };
});
