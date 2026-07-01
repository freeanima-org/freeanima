import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
  Textarea,
} from "@freeanima/ui-kit";
import { ConfirmDialog } from "@freeanima/ui-kit/composite";
import { AcpProgressDock } from "@chat/components/AcpProgressDock.tsx";
import { ToolBlockBubble } from "@chat/components/ToolBlockBubble.tsx";
import {
  ChatMessageBubble,
  findLastUserMessageIndex,
} from "@chat/components/ChatMessageBubble.tsx";
import { useAcpProgressDock } from "@chat/hooks/useAcpProgressDock.ts";
import { useEdgeSwipeOpen } from "@chat/hooks/useEdgeSwipeOpen.ts";
import { useKeyboardInset } from "@chat/hooks/useKeyboardInset.ts";
import { formatConversationIdDateTime } from "@chat/lib/format-datetime.ts";
import { displayAwaitingReply, pollUntilAssistantReply } from "@chat/lib/display-recovery.ts";
import {
  listConversationCommands,
  loadConfig,
  rollbackBeforeLastUserMessage,
  subscribeConversationEvents,
} from "@chat/lib/api.ts";
import { ListDetailLayout, useDrawerNav } from "@freeanima/ui-kit/layout";
import { reconnectHub, useHubConnection, useNetworkOnline } from "@freeanima/shell-sdk/react";
import { getAppLocale, initAppLocale, m, toggleAppLocale } from "@chat/lib/i18n.ts";
import { loadInputDraft, saveInputDraft } from "@chat/lib/input-draft.ts";
import { getSapDirectClient, subscribeShellConfigChanges } from "@chat/lib/sap-client.ts";
import type { ConversationListItem } from "@chat/lib/types.ts";
import {
  readModuleSelection,
  subscribeSubjectKind,
  writeModuleSelection,
} from "@freeanima/shell-sdk";
import { useChatStore } from "@chat/stores/chat.ts";
import { useConversationsStore } from "@chat/stores/conversations.ts";

initAppLocale();

type CommandItem = { name: string; description?: string };
type ClarifyPending = {
  items: Array<{ question: string; choices?: string[] }>;
  timeout_sec?: number;
};

function conversationLabel(item: ConversationListItem) {
  return item.title || formatConversationIdDateTime(item.id);
}

function readConversationFromUrl(): string | undefined {
  const id = new URLSearchParams(window.location.search).get("conversation")?.trim();
  return id || undefined;
}

function writeConversationToUrl(conversationId: string | null) {
  const url = new URL(window.location.href);
  if (conversationId) url.searchParams.set("conversation", conversationId);
  else url.searchParams.delete("conversation");
  window.history.replaceState(null, "", url);
}

function pickConversationId(
  list: ConversationListItem[],
  candidates: (string | null | undefined)[],
): string | undefined {
  for (const id of candidates) {
    if (id && list.some((c) => c.id === id)) return id;
  }
  return undefined;
}

function getSatelliteShell() {
  return window.satelliteShell;
}

function openHubSettingsIfAvailable(): void {
  getSatelliteShell()?.openHubSettings?.();
}

export function ChatApp() {
  const conversations = useConversationsStore((s) => s.conversations);
  const currentId = useConversationsStore((s) => s.currentId);
  const display = useConversationsStore((s) => s.display);
  const messagesLoading = useConversationsStore((s) => s.loading);
  const fetchConversations = useConversationsStore((s) => s.fetchConversations);
  const selectConversation = useConversationsStore((s) => s.selectConversation);
  const newConversationFn = useConversationsStore((s) => s.newConversation);
  const renameConversation = useConversationsStore((s) => s.renameConversation);
  const showArchived = useConversationsStore((s) => s.showArchived);
  const setShowArchived = useConversationsStore((s) => s.setShowArchived);
  const archiveConversationFn = useConversationsStore((s) => s.archiveConversation);
  const unarchiveConversationFn = useConversationsStore((s) => s.unarchiveConversation);
  const deleteConversationFn = useConversationsStore((s) => s.deleteConversation);
  const appendItem = useConversationsStore((s) => s.appendItem);
  const appendItemForConversation = useConversationsStore((s) => s.appendItemForConversation);
  const refreshMessages = useConversationsStore((s) => s.refreshMessages);
  const reloadConversationIfCurrent = useConversationsStore((s) => s.reloadConversationIfCurrent);
  const patchProgressLine = useConversationsStore((s) => s.patchProgressLine);

  const renderMd = useChatStore((s) => s.renderMd);
  const streaming = useChatStore((s) => s.streaming);
  const streamingConversationId = useChatStore((s) => s.streamingConversationId);
  const streamText = useChatStore((s) => s.streamText);
  const recovering = useChatStore((s) => s.recovering);
  const send = useChatStore((s) => s.send);
  const queue = useChatStore((s) => s.queue);
  const messageQueue = useMemo(
    () => (currentId ? queue.filter((q) => q.conversationId === currentId) : []),
    [currentId, queue],
  );

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const networkOnline = useNetworkOnline();
  const hubConnection = useHubConnection();
  const writesDisabled = !networkOnline || hubConnection !== "connected";
  const [locale, setLocale] = useState(getAppLocale());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    conversationId: null as string | null,
  });
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [messageMenu, setMessageMenu] = useState<{
    x: number;
    y: number;
    index: number;
    role: "user" | "assistant";
    content: string;
  } | null>(null);
  const [editingUserIndex, setEditingUserIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const sendingRef = useRef(false);
  const msgAreaRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const msgInputRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState(() =>
    loadInputDraft(readConversationFromUrl() ?? null),
  );
  const [commandList, setCommandList] = useState<CommandItem[]>([]);
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0);
  const [clarifyPending, setClarifyPending] = useState<ClarifyPending | null>(null);
  const pendingRecoveryKeyRef = useRef<string | null>(null);
  const nativeShell = Boolean(getSatelliteShell()?.isNativeShell);
  const drawerNav = useDrawerNav();
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const edgeSwipeHandlers = useEdgeSwipeOpen({
    enabled: drawerNav && !sidebarOpen,
    onOpen: openSidebar,
  });
  const keyboardInset = useKeyboardInset(nativeShell);

  const bootstrapConversation = useCallback(
    async (includeMemory = true) => {
      const list = await fetchConversations();
      const fromUrl = readConversationFromUrl();
      const stored = readModuleSelection("chat");
      const memId = includeMemory ? useConversationsStore.getState().currentId : null;
      const picked = pickConversationId(list, [fromUrl, stored, memId]);
      if (picked) {
        await selectConversation(picked);
        writeConversationToUrl(picked);
      } else if (list.length > 0) {
        const id = list[0]!.id;
        await selectConversation(id);
        writeConversationToUrl(id);
      } else {
        try {
          await getSapDirectClient().whenReady();
          await newConversationFn();
        } catch {
          /* 离线且无缓存：保持空态 */
        }
      }
      void getSapDirectClient()
        .whenReady()
        .then(() => listConversationCommands())
        .then((raw) => setCommandList((raw as { commands?: CommandItem[] }).commands ?? []))
        .catch((e) => console.error("commands:", e));
    },
    [fetchConversations, newConversationFn, selectConversation],
  );

  const streamVisible = streaming && streamingConversationId === currentId;

  const currentConversation = useMemo(
    () => conversations.find((s) => s.id === currentId),
    [conversations, currentId],
  );

  const activeConversations = useMemo(
    () => conversations.filter((s) => !s.archivedAt),
    [conversations],
  );

  const archivedConversations = useMemo(
    () => conversations.filter((s) => s.archivedAt),
    [conversations],
  );

  const contextConversation = useMemo(
    () => conversations.find((s) => s.id === contextMenu.conversationId),
    [conversations, contextMenu.conversationId],
  );

  const headerTitle = currentId
    ? conversationLabel(
        currentConversation ?? {
          id: currentId,
          title: "",
          created: "",
          platform: "",
        },
      )
    : m.admin_chat_title();

  const acpDock = useAcpProgressDock(currentId, {
    patchProgress: patchProgressLine,
    onDecision: async (sid) => {
      const baseline = useConversationsStore.getState().display.length;
      await refreshMessages(sid, baseline);
    },
  });

  const INPUT_MAX_HEIGHT_PX = 192;

  const slashPrefix = useMemo(() => {
    if (!inputText.startsWith("/")) return null;
    const body = inputText.slice(1);
    if (body.includes(" ")) return null;
    return body.toLowerCase();
  }, [inputText]);

  const filteredCommands = useMemo(() => {
    if (slashPrefix == null) return [];
    return commandList.filter((c) => c.name.toLowerCase().startsWith(slashPrefix));
  }, [commandList, slashPrefix]);

  const showCmdMenu = filteredCommands.length > 0;
  const lastUserMessageIndex = useMemo(() => findLastUserMessageIndex(display), [display]);

  const openMessageMenu = (
    index: number,
    role: "user" | "assistant",
    content: string,
    clientX: number,
    clientY: number,
  ) => {
    setMessageMenu({ x: clientX, y: clientY, index, role, content });
  };

  const copyMessageText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
    setMessageMenu(null);
  };

  const startReeditUserMessage = () => {
    if (!messageMenu) return;
    setEditingUserIndex(messageMenu.index);
    setEditDraft(messageMenu.content);
    setMessageMenu(null);
  };

  const confirmReeditUserMessage = async () => {
    const text = editDraft.trim();
    if (!currentId || editingUserIndex == null || !text || sendingRef.current || writesDisabled) {
      return;
    }
    const originConversationId = currentId;
    sendingRef.current = true;
    setEditingUserIndex(null);
    setEditDraft("");
    try {
      await rollbackBeforeLastUserMessage(originConversationId);
      await selectConversation(originConversationId);
      stickToBottomRef.current = true;
      appendItem({ type: "message", role: "user", content: text });
      await dispatchSend(text, originConversationId);
    } finally {
      sendingRef.current = false;
    }
  };

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (hubConnection === "disconnected") {
        await reconnectHub();
      }
      useChatStore.getState().abortStream();
      await fetchConversations();
      if (currentId) {
        await selectConversation(currentId);
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, hubConnection, currentId, fetchConversations, selectConversation]);

  useEffect(() => {
    if (hubConnection === "disconnected") {
      useChatStore.getState().abortStream();
    }
  }, [hubConnection]);

  useEffect(() => subscribeShellConfigChanges(), []);

  useEffect(() => {
    void (async () => {
      try {
        await loadConfig();
        getSapDirectClient();
        setReady(true);
        void bootstrapConversation().catch((e) => {
          console.error("chat bootstrap:", e);
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [bootstrapConversation]);

  useEffect(() => {
    if (!ready) return;
    return subscribeSubjectKind(() => {
      void bootstrapConversation(false).catch((e) => console.error("chat subject bootstrap:", e));
    });
  }, [ready, bootstrapConversation]);

  useEffect(() => {
    if (hubConnection !== "connected") return;
    void fetchConversations();
  }, [hubConnection, fetchConversations]);

  useEffect(() => {
    const close = () => {
      setContextMenu((menu) => ({ ...menu, visible: false }));
      setMessageMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    const el = msgAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 96;
      stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [currentId]);

  useEffect(() => {
    if (!currentId) return;
    writeConversationToUrl(currentId);
    writeModuleSelection("chat", currentId);
    setInputText(loadInputDraft(currentId));
    stickToBottomRef.current = true;
    requestAnimationFrame(() => {
      if (!nativeShell) msgInputRef.current?.focus();
      resizeInput();
      scrollDown({ force: true });
    });
  }, [currentId, nativeShell]);

  useEffect(() => {
    if (!currentId) return;
    scrollDown();
  }, [display.length, currentId]);

  useEffect(() => {
    if (!currentId) return;
    const sub = subscribeConversationEvents(currentId, () => {
      void fetchConversations();
    });
    return () => sub.unsubscribe();
  }, [currentId, fetchConversations]);

  /** 刷新或切回会话时：末条为 user 且无 assistant → 轮询直到 Hub 落库 */
  useEffect(() => {
    if (!currentId) return;
    if (streaming && streamingConversationId === currentId) return;
    if (!displayAwaitingReply(display)) {
      pendingRecoveryKeyRef.current = null;
      return;
    }
    const key = `${currentId}@${display.length}`;
    if (pendingRecoveryKeyRef.current === key) return;
    pendingRecoveryKeyRef.current = key;

    const baseline = display.length;
    let cancelled = false;
    useChatStore.setState({ recovering: true });

    const sub = subscribeConversationEvents(currentId, () => {
      void refreshMessages(currentId, baseline);
    });

    void pollUntilAssistantReply(currentId, (id) => refreshMessages(id, baseline)).finally(() => {
      if (!cancelled) useChatStore.setState({ recovering: false });
    });

    return () => {
      cancelled = true;
      sub.unsubscribe();
      useChatStore.setState({ recovering: false });
    };
  }, [currentId, display, streaming, streamingConversationId, refreshMessages]);

  const scrollDown = (opts?: { force?: boolean }) => {
    requestAnimationFrame(() => {
      const el = msgAreaRef.current;
      if (!el) return;
      if (!opts?.force && !stickToBottomRef.current) return;
      el.scrollTop = el.scrollHeight;
    });
  };

  const resizeInput = () => {
    const el = msgInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX)}px`;
  };

  const applyCommand = (cmd: CommandItem) => {
    setInputText(`/${cmd.name} `);
    setSelectedCmdIdx(0);
    requestAnimationFrame(() => {
      resizeInput();
      msgInputRef.current?.focus();
    });
  };

  const navigateToConversation = async (conversationId: string) => {
    if (conversationId === currentId) {
      setSidebarOpen(false);
      return;
    }
    setClarifyPending(null);
    await selectConversation(conversationId);
    setSidebarOpen(false);
  };

  const newConversation = async () => {
    const id = await newConversationFn();
    if (id) {
      writeConversationToUrl(id);
      requestAnimationFrame(() => {
        if (!nativeShell) msgInputRef.current?.focus();
        resizeInput();
      });
    }
  };

  const ensureConversation = async (): Promise<string | null> => {
    const existing = useConversationsStore.getState().currentId;
    if (existing) return existing;
    const id = await newConversationFn();
    if (id) writeConversationToUrl(id);
    return id;
  };

  const startConversation = () => void newConversation();

  const startRename = () => {
    const s = conversations.find((x) => x.id === contextMenu.conversationId);
    setRenameText((s && s.title) || "");
    setShowRenameDialog(true);
    setContextMenu((menu) => ({ ...menu, visible: false }));
    requestAnimationFrame(() => renameInputRef.current?.focus());
  };

  const confirmRename = async () => {
    const title = renameText.trim();
    if (title && contextMenu.conversationId) {
      await renameConversation(contextMenu.conversationId, title);
    }
    setShowRenameDialog(false);
    setRenameText("");
  };

  const startDelete = () => {
    setDeleteTargetId(contextMenu.conversationId);
    setShowDeleteDialog(true);
    setContextMenu((menu) => ({ ...menu, visible: false }));
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const nextId = await deleteConversationFn(deleteTargetId);
    writeConversationToUrl(nextId);
    setShowDeleteDialog(false);
    setDeleteTargetId(null);
  };

  const handleArchive = async () => {
    const id = contextMenu.conversationId;
    if (!id) return;
    setContextMenu((menu) => ({ ...menu, visible: false }));
    const nextId = await archiveConversationFn(id);
    writeConversationToUrl(nextId);
  };

  const handleUnarchive = async () => {
    const id = contextMenu.conversationId;
    if (!id) return;
    setContextMenu((menu) => ({ ...menu, visible: false }));
    await unarchiveConversationFn(id);
  };

  const toggleShowArchived = () => {
    void setShowArchived(!showArchived);
  };

  const renderConversationItem = (s: ConversationListItem, faded = false) => (
    <div
      key={s.id}
      className={[
        "session-item",
        s.id === currentId ? "sidebar-nav-active" : "",
        faded ? "opacity-60" : "",
      ].join(" ")}
      onClick={() => void navigateToConversation(s.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          conversationId: s.id,
        });
      }}
    >
      <div className="truncate">{conversationLabel(s)}</div>
    </div>
  );

  const flushQueueRef = useRef<(conversationId: string) => Promise<void>>(async () => {});

  const dispatchSend = useCallback(
    async (text: string, originConversationId: string) => {
      const displayBaseline = useConversationsStore.getState().display.length;
      if (clarifyPending) setClarifyPending(null);
      scrollDown();

      const isViewingOrigin = () =>
        useConversationsStore.getState().currentId === originConversationId;

      await send(originConversationId, text, {
        recoverDisplay: (id) => refreshMessages(id, displayBaseline),
        onToken: () => {
          if (!isViewingOrigin()) return;
          scrollDown();
        },
        onDisplayAppend: (item) => {
          appendItemForConversation(originConversationId, item);
          if (isViewingOrigin()) scrollDown();
        },
        onAwaitingClarify: (data) => {
          if (!isViewingOrigin()) return;
          if (Array.isArray(data.items) && data.items.length > 0) {
            setClarifyPending({
              items: data.items as ClarifyPending["items"],
              timeout_sec: (data.timeout_sec as number | undefined) ?? 1800,
            });
          }
          scrollDown();
        },
        onError: (msg) => {
          appendItemForConversation(originConversationId, {
            type: "message",
            role: "assistant",
            content: `⚠️ ${msg}`,
          });
          if (isViewingOrigin()) scrollDown();
        },
        onDone: (opts) => {
          if (opts?.recovered) {
            if (isViewingOrigin()) scrollDown();
            void flushQueueRef.current(originConversationId);
            return;
          }
          void reloadConversationIfCurrent(originConversationId);
          if (isViewingOrigin()) scrollDown();
          void flushQueueRef.current(originConversationId);
        },
      });
    },
    [appendItemForConversation, clarifyPending, refreshMessages, reloadConversationIfCurrent, send],
  );

  flushQueueRef.current = async (conversationId: string) => {
    const next = useChatStore.getState().peekQueue(conversationId);
    if (!next || sendingRef.current) return;
    const item = useChatStore.getState().takeQueued(next.id);
    if (!item) return;
    appendItemForConversation(item.conversationId, {
      type: "message",
      role: "user",
      content: item.text,
    });
    scrollDown();
    sendingRef.current = true;
    try {
      await dispatchSend(item.text, item.conversationId);
    } finally {
      sendingRef.current = false;
    }
  };

  const offlineCachedHint = m.ui_offline_cached_hint();
  const showOfflineCachedHint = writesDisabled && (conversations.length > 0 || display.length > 0);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sendingRef.current || writesDisabled) return;

    let conversationId = currentId;
    if (!conversationId) {
      conversationId = await ensureConversation();
      if (!conversationId) return;
    }

    if (streamVisible) {
      useChatStore.getState().enqueue(conversationId, text);
      setInputText("");
      saveInputDraft(conversationId, "");
      requestAnimationFrame(resizeInput);
      return;
    }

    const originConversationId = conversationId;
    sendingRef.current = true;
    setInputText("");
    saveInputDraft(originConversationId, "");
    requestAnimationFrame(resizeInput);
    appendItem({ type: "message", role: "user", content: text });

    try {
      await dispatchSend(text, originConversationId);
    } finally {
      sendingRef.current = false;
    }
  };

  const sendQueuedNow = async (queueId: string) => {
    if (!currentId || sendingRef.current) return;
    const item = useChatStore.getState().takeQueued(queueId);
    if (!item || item.conversationId !== currentId) return;

    sendingRef.current = true;
    appendItemForConversation(item.conversationId, {
      type: "message",
      role: "user",
      content: item.text,
    });
    scrollDown();
    try {
      await dispatchSend(item.text, item.conversationId);
    } finally {
      sendingRef.current = false;
    }
  };

  const stopStreaming = async () => {
    if (!currentId || !streamVisible) return;
    await useChatStore.getState().stop(currentId);
  };

  const onInputKeydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCmdMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCmdIdx((i) => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCmdIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        applyCommand(filteredCommands[selectedCmdIdx]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInputText("");
        saveInputDraft(currentId, "");
        setSelectedCmdIdx(0);
        requestAnimationFrame(resizeInput);
        return;
      }
    }
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void sendMessage();
  };

  if (!ready && !error) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-lg font-bold">{m.admin_chat_title()}</h2>
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground">
            {getSatelliteShell()?.hubWsUrl
              ? nativeShell
                ? "请确认 Hub 已运行，或在设置中检查 Hub 地址。"
                : "请确认 Hub 已运行（anima service start）。"
              : "请确认 Hub 已运行，且 chat dev server 提供 /config.json。"}
          </p>
          {nativeShell ? (
            <Button type="button" size="sm" onClick={openHubSettingsIfAvailable}>
              Hub 设置
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-app h-full flex flex-col min-h-0" {...edgeSwipeHandlers}>
      <header className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border bg-muted">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={drawerNav ? "" : "hidden"}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          ☰
        </Button>
        <span className="truncate text-sm font-medium">{headerTitle}</span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2"
          disabled={refreshing || !ready}
          aria-label={m.admin_common_refresh()}
          onClick={() => void handleManualRefresh()}
        >
          {refreshing ? <Spinner className="size-3.5" /> : m.admin_common_refresh()}
        </Button>
        <Button
          type="button"
          size="sm"
          className={`h-7 px-2 ${drawerNav ? "" : "hidden"}`}
          onClick={startConversation}
        >
          {m.admin_common_new_conversation()}
        </Button>
        {nativeShell ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={openHubSettingsIfAvailable}
          >
            Hub
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => setLocale(toggleAppLocale())}
        >
          {locale === "zh-cn" ? "EN" : "中文"}
        </Button>
      </header>
      {showOfflineCachedHint ? (
        <p className="shrink-0 border-b border px-3 py-1 text-xs text-muted-foreground">
          {offlineCachedHint.trim()}
        </p>
      ) : null}

      <ListDetailLayout
        detailTitle={headerTitle}
        detailHeaderPlacement="none"
        showDetailHeader={false}
        showListHeader={false}
        listWidthClass="w-64"
        listAsideClassName="border bg-background"
        listOpen={sidebarOpen}
        onListOpenChange={setSidebarOpen}
        list={() => (
          <>
            <div className="shrink-0 space-y-2 p-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => void newConversation()}
              >
                {m.admin_common_new_conversation()}
              </Button>
              <label className="text-muted-foreground flex cursor-pointer select-none items-center gap-2 px-1 text-xs">
                <Checkbox
                  className="size-3.5"
                  checked={showArchived}
                  onCheckedChange={() => toggleShowArchived()}
                />
                {m.chat_show_archived()}
              </label>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-2 py-1">
              {activeConversations.map((s) => renderConversationItem(s))}
              {showArchived && archivedConversations.length > 0 ? (
                <div className="border/60 mt-2 space-y-1 border-t pt-2">
                  <div className="text-muted-foreground px-1 text-[11px] font-medium tracking-wide uppercase">
                    {m.chat_archived_section()}
                  </div>
                  {archivedConversations.map((s) => renderConversationItem(s, true))}
                </div>
              ) : null}
            </div>
          </>
        )}
      >
        {acpDock ? (
          <div className="shrink-0 px-4 pt-3">
            <AcpProgressDock dock={acpDock} />
          </div>
        ) : null}

        <div
          ref={msgAreaRef}
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 space-y-4"
        >
          {!currentId ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-foreground/40 text-sm">
              <p>{m.admin_chat_select_conversation()}</p>
              <Button type="button" size="sm" disabled={writesDisabled} onClick={startConversation}>
                {m.admin_common_new_conversation()}
              </Button>
            </div>
          ) : messagesLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner className="size-6" />
            </div>
          ) : display.length === 0 && !streamVisible && !recovering ? (
            <div className="flex items-center justify-center h-full text-foreground/40 text-sm">
              {m.admin_chat_send_first_message()}
            </div>
          ) : null}

          {display.map((item, i) => {
            if (item.type === "message" && item.role === "user") {
              if (editingUserIndex === i) {
                return (
                  <div key={`d${i}`} className="flex justify-end min-w-0 max-w-full">
                    <div className="chat-bubble chat-bubble-user w-full max-w-full space-y-2">
                      <Textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        className="min-h-[4rem] w-full resize-y bg-background/10 text-primary-foreground"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-primary-foreground"
                          onClick={() => {
                            setEditingUserIndex(null);
                            setEditDraft("");
                          }}
                        >
                          {m.admin_common_cancel()}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7"
                          disabled={!editDraft.trim() || writesDisabled}
                          onClick={() => void confirmReeditUserMessage()}
                        >
                          {m.admin_common_confirm()}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <ChatMessageBubble
                  key={`d${i}`}
                  align="end"
                  className="chat-bubble-user whitespace-pre-wrap"
                  onLongPress={(coords) =>
                    openMessageMenu(i, "user", item.content, coords.x, coords.y)
                  }
                >
                  {item.content}
                </ChatMessageBubble>
              );
            }
            if (item.type === "message" && item.role === "assistant") {
              return (
                <ChatMessageBubble
                  key={`d${i}`}
                  align="start"
                  className="chat-bubble-assistant"
                  onLongPress={(coords) =>
                    openMessageMenu(i, "assistant", item.content, coords.x, coords.y)
                  }
                >
                  <div
                    className="md-content min-w-0 max-w-full"
                    dangerouslySetInnerHTML={{ __html: renderMd(item.content) }}
                  />
                </ChatMessageBubble>
              );
            }
            if (item.type === "tool_block") {
              return (
                <div key={`d${i}`} className="flex max-w-full justify-start">
                  <ToolBlockBubble calls={item.calls} />
                </div>
              );
            }
            return null;
          })}

          {clarifyPending ? (
            <Alert variant="info" className="shadow-sm">
              <AlertDescription className="w-full space-y-2">
                <p className="font-medium">{m.admin_chat_clarify_hint()}</p>
                {clarifyPending.items.map((item, ci) => (
                  <div key={ci} className="text-sm">
                    <p>
                      {ci + 1}. {item.question}
                    </p>
                    {item.choices?.length ? (
                      <ul className="text-muted-foreground ml-2 list-inside list-disc">
                        {item.choices.map((choice, chi) => (
                          <li key={chi}>{choice}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}

          {streamVisible && streamText ? (
            <div className="flex justify-start">
              <div className="chat-bubble chat-bubble-assistant">
                <div
                  className="md-content"
                  dangerouslySetInnerHTML={{ __html: renderMd(streamText) }}
                />
                <Spinner className="mt-1 size-3" />
              </div>
            </div>
          ) : null}

          {recovering ? (
            <div className="flex justify-start">
              <div className="chat-bubble chat-bubble-assistant text-muted-foreground flex items-center gap-2 text-sm">
                <Spinner className="size-3" />
                {m.admin_message_waiting_result()}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="border-t border p-4 bg-background relative chat-compose"
          style={keyboardInset > 0 ? { transform: `translateY(-${keyboardInset}px)` } : undefined}
        >
          {messageQueue.length > 0 ? (
            <ul className="mb-2 space-y-1">
              {messageQueue.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 text-sm bg-muted/60 rounded-lg px-2 py-1.5"
                >
                  <span className="flex-1 truncate text-muted-foreground">{item.text}</span>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 shrink-0 px-2"
                    onClick={() => void sendQueuedNow(item.id)}
                  >
                    {m.admin_chat_queue_send_now()}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <form
            className="flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (streamVisible) {
                void stopStreaming();
              } else {
                void sendMessage();
              }
            }}
          >
            <div className="flex-1 relative">
              {showCmdMenu ? (
                <ul className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-lg border border bg-background shadow-lg z-10">
                  {filteredCommands.map((cmd, i) => (
                    <li
                      key={cmd.name}
                      className={[
                        "px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2 hover:bg-muted",
                        i === selectedCmdIdx ? "bg-primary/15" : "",
                      ].join(" ")}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyCommand(cmd);
                      }}
                    >
                      <span className="font-mono font-medium shrink-0">/{cmd.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {cmd.description}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Textarea
                ref={msgInputRef}
                value={inputText}
                onChange={(e) => {
                  const next = e.target.value;
                  setInputText(next);
                  saveInputDraft(currentId, next);
                  setSelectedCmdIdx(0);
                  resizeInput();
                }}
                rows={1}
                className="min-h-[2.75rem] max-h-48 w-full resize-none py-2.5 leading-normal"
                placeholder={m.admin_chat_message_placeholder()}
                disabled={writesDisabled}
                onFocus={() => {
                  requestAnimationFrame(() => {
                    msgInputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                  });
                }}
                onKeyDown={onInputKeydown}
              />
            </div>
            {streamVisible ? (
              <Button type="submit" variant="destructive" disabled={writesDisabled}>
                {m.admin_common_stop()}
              </Button>
            ) : (
              <Button type="submit" disabled={!inputText.trim() || writesDisabled}>
                {m.admin_common_send()}
              </Button>
            )}
          </form>
        </div>
      </ListDetailLayout>

      {messageMenu ? (
        <div
          className="fixed z-50 bg-background border border rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ top: messageMenu.y, left: messageMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-3 py-1.5 hover:bg-muted cursor-pointer text-sm"
            onClick={() => void copyMessageText(messageMenu.content)}
          >
            {m.admin_common_copy()}
          </div>
          {messageMenu.role === "user" && messageMenu.index === lastUserMessageIndex ? (
            <div
              className="px-3 py-1.5 hover:bg-muted cursor-pointer text-sm"
              onClick={startReeditUserMessage}
            >
              {m.admin_common_edit()}
            </div>
          ) : null}
        </div>
      ) : null}

      {contextMenu.visible ? (
        <div
          className="fixed z-50 bg-background border border rounded-lg shadow-xl py-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-1.5 hover:bg-muted cursor-pointer text-sm" onClick={startRename}>
            {m.admin_common_rename()}
          </div>
          {contextConversation?.archivedAt ? (
            <div
              className="px-3 py-1.5 hover:bg-muted cursor-pointer text-sm"
              onClick={() => void handleUnarchive()}
            >
              {m.chat_unarchive()}
            </div>
          ) : (
            <div
              className="px-3 py-1.5 hover:bg-muted cursor-pointer text-sm"
              onClick={() => void handleArchive()}
            >
              {m.chat_archive()}
            </div>
          )}
          <div
            className="px-3 py-1.5 hover:bg-muted cursor-pointer text-sm text-destructive"
            onClick={startDelete}
          >
            {m.chat_delete()}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={showDeleteDialog}
        title={m.chat_delete()}
        description={m.chat_delete_confirm()}
        confirmLabel={m.chat_delete()}
        variant="error"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setShowDeleteDialog(false)}
      />

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{m.admin_common_edit_title()}</DialogTitle>
          </DialogHeader>
          <Input
            ref={renameInputRef}
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            type="text"
            className="text-sm"
            placeholder={m.admin_common_title_placeholder()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirmRename();
              if (e.key === "Escape") setShowRenameDialog(false);
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowRenameDialog(false)}
            >
              {m.admin_common_cancel()}
            </Button>
            <Button type="button" size="sm" onClick={() => void confirmRename()}>
              {m.admin_common_confirm()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
