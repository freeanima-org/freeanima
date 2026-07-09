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
  Switch,
  Textarea,
} from "@freeanima/frontend/ui-kit";
import { ConfirmDialog, ActionSheet, ContextMenu } from "@freeanima/frontend/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/frontend/ui-kit/composite";
import { AcpProgressDock } from "@freeanima/features/chat/ui/spa/components/AcpProgressDock.tsx";
import { ToolBlockBubble } from "@freeanima/features/chat/ui/spa/components/ToolBlockBubble.tsx";
import {
  ChatMessageBubble,
  findLastUserMessageIndex,
} from "@freeanima/features/chat/ui/spa/components/ChatMessageBubble.tsx";
import { ConversationListItem as ConversationListRow } from "@freeanima/features/chat/ui/spa/components/ConversationListItem.tsx";
import { useAcpProgressDock } from "@freeanima/features/chat/ui/spa/hooks/useAcpProgressDock.ts";
import { useEdgeSwipeOpen } from "@freeanima/features/chat/ui/spa/hooks/useEdgeSwipeOpen.ts";
import { useKeyboardInset } from "@freeanima/features/chat/ui/spa/hooks/useKeyboardInset.ts";
import { formatConversationIdDateTime } from "@freeanima/features/chat/ui/spa/lib/format-datetime.ts";
import {
  displayAwaitingReply,
  pollUntilAssistantReply,
} from "@freeanima/features/chat/ui/spa/lib/display-recovery.ts";
import {
  listConversationCommands,
  loadConfig,
  rollbackBeforeLastUserMessage,
  subscribeConversationEvents,
} from "@freeanima/features/chat/ui/spa/lib/api.ts";
import { ListDetailLayout, useDrawerNav, useMobileLayout } from "@freeanima/frontend/ui-kit/layout";
import {
  reconnectHub,
  useActionSheetCapability,
  useContextMenuCapability,
  useHubConnection,
  useNetworkOnline,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { initAppLocale, m } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";
import { loadInputDraft, saveInputDraft } from "@freeanima/features/chat/ui/spa/lib/input-draft.ts";
import {
  getSapDirectClient,
  subscribeShellConfigChanges,
} from "@freeanima/features/chat/ui/spa/lib/sap-client.ts";
import { LlmDebugPanel } from "@freeanima/features/chat/ui/spa/components/LlmDebugPanel.tsx";
import type {
  ConversationListItem,
  LlmDebugSnapshots,
} from "@freeanima/features/chat/ui/spa/lib/types.ts";
import {
  readModuleSelection,
  subscribeSubjectKind,
  writeModuleSelection,
} from "@freeanima/frontend/shell-sdk";
import { MessageActionBar } from "@freeanima/features/chat/ui/spa/components/MessageActionBar.tsx";
import { useSpeechPlayback } from "@freeanima/features/chat/ui/spa/hooks/useSpeechPlayback.ts";
import { markdownToPlainText } from "@freeanima/features/chat/ui/spa/lib/speech/plain-text.ts";
import { VaultUnlockButton } from "@freeanima/features/chat/ui/spa/components/VaultUnlockButton.tsx";
import { useChatStore } from "@freeanima/features/chat/ui/spa/stores/chat.ts";
import { useConversationsStore } from "@freeanima/features/chat/ui/spa/stores/conversations.ts";

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

function isTransportFailureMessage(msg: string): boolean {
  return /timed out|websocket|hub_rpc_timeout|网络错误/i.test(msg);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuConversationId, setMenuConversationId] = useState<string | null>(null);
  const [convPointerMenu, setConvPointerMenu] = useState<{ x: number; y: number } | null>(null);
  const [convSheetOpen, setConvSheetOpen] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
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
  const [llmDebugEnabled, setLlmDebugEnabled] = useState(false);
  const [debugViewerOpen, setDebugViewerOpen] = useState(false);
  const [llmDebugSnapshots, setLlmDebugSnapshots] = useState<LlmDebugSnapshots | null>(null);
  const pendingRecoveryKeyRef = useRef<string | null>(null);
  const nativeShell = Boolean(getSatelliteShell()?.isNativeShell);
  const isElectron = Boolean(getSatelliteShell()?.isElectron);
  const mobileLayout = useMobileLayout();
  /** 手机 / 窄视口 / 移动壳：Enter 换行；桌面浏览器与 Electron 仍 Enter 发送 */
  const enterToSend = !mobileLayout && (!nativeShell || isElectron);
  const useActionSheet = useActionSheetCapability();
  const contextMenuEnabled = useContextMenuCapability();
  const drawerNav = useDrawerNav();
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const edgeSwipeHandlers = useEdgeSwipeOpen({
    enabled: drawerNav && !sidebarOpen,
    onOpen: openSidebar,
  });
  const keyboardInset = useKeyboardInset(nativeShell);
  const {
    toggle: toggleSpeech,
    stop: stopSpeech,
    isSpeaking,
    isSupported: speechSupported,
    unsupportedReason: speechUnsupportedReason,
    playbackError: speechPlaybackError,
  } = useSpeechPlayback();

  const startReeditUserMessage = useCallback((index: number, content: string) => {
    setEditingUserIndex(index);
    setEditDraft(content);
  }, []);

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
        const first = list[0];
        if (first) {
          await selectConversation(first.id);
          writeConversationToUrl(first.id);
        }
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
    () => conversations.find((s) => s.id === menuConversationId),
    [conversations, menuConversationId],
  );

  const closeConversationMenu = useCallback(() => {
    setMenuConversationId(null);
    setConvPointerMenu(null);
    setConvSheetOpen(false);
  }, []);

  const openConversationMenu = useCallback(
    (conversationId: string, coords?: { x: number; y: number }) => {
      setMenuConversationId(conversationId);
      if (useActionSheet) {
        setConvSheetOpen(true);
        setConvPointerMenu(null);
        return;
      }
      if (coords && contextMenuEnabled) {
        setConvPointerMenu(coords);
        setConvSheetOpen(false);
      }
    },
    [useActionSheet, contextMenuEnabled],
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
    : m.console_chat_title();

  const acpDock = useAcpProgressDock(currentId, {
    patchProgress: patchProgressLine,
    onDecision: async (sid) => {
      const baseline = useConversationsStore.getState().display.length;
      await refreshMessages(sid, baseline);
    },
  });

  const INPUT_MIN_HEIGHT_PX = 36;
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
  /** 窄视口/手机：菜单随输入区文档流展开，避免 absolute + 祖先 overflow-hidden 在软键盘顶起时被裁切 */
  const cmdMenuInFlow = mobileLayout;
  const lastUserMessageIndex = useMemo(() => findLastUserMessageIndex(display), [display]);

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
    if (hubConnection !== "connected") {
      useChatStore.getState().abortStream();
      sendingRef.current = false;
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
    stopSpeech();
  }, [currentId, stopSpeech]);

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
      resizeInput();
      scrollDown({ force: true });
    });
  }, [currentId]);

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
    el.style.height = "0px";
    const next = Math.max(INPUT_MIN_HEIGHT_PX, Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX));
    el.style.height = `${next}px`;
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
      requestAnimationFrame(resizeInput);
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
    const s = conversations.find((x) => x.id === menuConversationId);
    setRenameText((s && s.title) || "");
    setShowRenameDialog(true);
    closeConversationMenu();
    requestAnimationFrame(() => renameInputRef.current?.focus());
  };

  const confirmRename = async () => {
    const title = renameText.trim();
    if (title && menuConversationId) {
      await renameConversation(menuConversationId, title);
    }
    setShowRenameDialog(false);
    setRenameText("");
  };

  const startDelete = () => {
    setDeleteTargetId(menuConversationId);
    setShowDeleteDialog(true);
    closeConversationMenu();
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const nextId = await deleteConversationFn(deleteTargetId);
    writeConversationToUrl(nextId);
    setShowDeleteDialog(false);
    setDeleteTargetId(null);
  };

  const handleArchive = async () => {
    const id = menuConversationId;
    if (!id) return;
    closeConversationMenu();
    const nextId = await archiveConversationFn(id);
    writeConversationToUrl(nextId);
  };

  const handleUnarchive = async () => {
    const id = menuConversationId;
    if (!id) return;
    closeConversationMenu();
    await unarchiveConversationFn(id);
  };

  const toggleShowArchived = () => {
    void setShowArchived(!showArchived);
  };

  const conversationMenuItems: ActionSheetItem[] = menuConversationId
    ? [
        { label: m.console_common_rename(), onClick: startRename },
        ...(contextConversation?.archivedAt
          ? [{ label: m.chat_unarchive(), onClick: () => void handleUnarchive() }]
          : [{ label: m.chat_archive(), onClick: () => void handleArchive() }]),
        {
          label: m.chat_delete(),
          danger: true,
          onClick: startDelete,
        },
      ]
    : [];

  const renderConversationItem = (s: ConversationListItem, faded = false) => (
    <ConversationListRow
      key={s.id}
      conversation={s}
      label={conversationLabel(s)}
      active={s.id === currentId}
      faded={faded}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      onNavigate={(id) => void navigateToConversation(id)}
      onOpenMenu={openConversationMenu}
    />
  );

  const flushQueueRef = useRef<(conversationId: string) => Promise<void>>(async () => {});

  const dispatchSend = useCallback(
    async (text: string, originConversationId: string) => {
      const displayBaseline = useConversationsStore.getState().display.length;
      if (clarifyPending) setClarifyPending(null);
      scrollDown();

      const isViewingOrigin = () =>
        useConversationsStore.getState().currentId === originConversationId;

      if (llmDebugEnabled) {
        setLlmDebugSnapshots(null);
      }

      await send(
        originConversationId,
        text,
        {
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
            if (isTransportFailureMessage(msg)) {
              void reconnectHub().catch(() => undefined);
            }
            if (isViewingOrigin()) scrollDown();
          },
          onDone: (opts) => {
            if (opts?.recovered) {
              if (isViewingOrigin()) scrollDown();
              void flushQueueRef.current(originConversationId);
              return;
            }
            void reloadConversationIfCurrent(originConversationId);
            void fetchConversations();
            if (isViewingOrigin()) scrollDown();
            void flushQueueRef.current(originConversationId);
          },
          onLlmDebug: (snapshot) => {
            if (!llmDebugEnabled) return;
            setLlmDebugSnapshots((prev) => {
              const next = { ...prev };
              if (snapshot.phase === "initial") next.initial = snapshot;
              else next.final = snapshot;
              return next;
            });
          },
        },
        { llmDebug: llmDebugEnabled },
      );
    },
    [
      appendItemForConversation,
      clarifyPending,
      llmDebugEnabled,
      refreshMessages,
      reloadConversationIfCurrent,
      fetchConversations,
      send,
    ],
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
        const cmd = filteredCommands[selectedCmdIdx];
        if (cmd) applyCommand(cmd);
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
    if (!enterToSend) return;
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
          <h2 className="text-lg font-bold">{m.console_chat_title()}</h2>
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
        <VaultUnlockButton conversationId={currentId} className="h-7" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2"
          disabled={refreshing || !ready}
          aria-label={m.console_common_refresh()}
          onClick={() => void handleManualRefresh()}
        >
          {refreshing ? <Spinner className="size-3.5" /> : m.console_common_refresh()}
        </Button>
        <Button
          type="button"
          size="sm"
          className={`h-7 px-2 ${drawerNav ? "" : "hidden"}`}
          onClick={startConversation}
        >
          {m.console_common_new_conversation()}
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
        <label className="flex h-7 shrink-0 cursor-pointer select-none items-center gap-1.5 px-1">
          <Switch
            checked={llmDebugEnabled}
            onCheckedChange={(checked) => {
              const enabled = checked === true;
              if (!enabled) {
                setLlmDebugSnapshots(null);
                setDebugViewerOpen(false);
              }
              setLlmDebugEnabled(enabled);
            }}
            aria-label={m.chat_llm_debug_toggle()}
          />
          <span
            className={`text-xs ${llmDebugEnabled ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            {m.chat_llm_debug_toggle()}
          </span>
        </label>
        <Button
          type="button"
          variant={debugViewerOpen ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2"
          disabled={!llmDebugSnapshots?.initial && !llmDebugSnapshots?.final}
          onClick={() => setDebugViewerOpen((open) => !open)}
        >
          {m.chat_llm_debug_view()}
        </Button>
      </header>
      {showOfflineCachedHint ? (
        <p className="shrink-0 border-b border px-3 py-1 text-xs text-muted-foreground">
          {offlineCachedHint.trim()}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ListDetailLayout
            detailTitle={headerTitle}
            detailHeaderPlacement="none"
            showDetailHeader={false}
            showListHeader={false}
            columnSplitKey="chat"
            defaultListWidthPx={256}
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
                    {m.console_common_new_conversation()}
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
                  <p>{m.console_chat_select_conversation()}</p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={writesDisabled}
                    onClick={startConversation}
                  >
                    {m.console_common_new_conversation()}
                  </Button>
                </div>
              ) : messagesLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner className="size-6" />
                </div>
              ) : display.length === 0 && !streamVisible && !recovering ? (
                <div className="flex items-center justify-center h-full text-foreground/40 text-sm">
                  {m.console_chat_send_first_message()}
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
                              {m.console_common_cancel()}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7"
                              disabled={!editDraft.trim() || writesDisabled}
                              onClick={() => void confirmReeditUserMessage()}
                            >
                              {m.console_common_confirm()}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={`d${i}`} className="flex min-w-0 max-w-full flex-col items-end">
                      <ChatMessageBubble
                        align="end"
                        className="chat-bubble-user whitespace-pre-wrap"
                      >
                        {item.content}
                      </ChatMessageBubble>
                      <MessageActionBar
                        align="end"
                        copyContent={item.content}
                        speechText={item.content}
                        speaking={isSpeaking(`msg-${i}`)}
                        speechSupported={speechSupported}
                        speechUnsupportedReason={speechUnsupportedReason}
                        onToggleSpeech={() => toggleSpeech(`msg-${i}`, item.content)}
                        {...(i === lastUserMessageIndex
                          ? { onEdit: () => startReeditUserMessage(i, item.content) }
                          : {})}
                      />
                    </div>
                  );
                }
                if (item.type === "message" && item.role === "assistant") {
                  const speechText = markdownToPlainText(item.content);
                  return (
                    <div key={`d${i}`} className="flex min-w-0 max-w-full flex-col items-start">
                      <ChatMessageBubble align="start" className="chat-bubble-assistant">
                        <div
                          className="md-content min-w-0 max-w-full"
                          dangerouslySetInnerHTML={{ __html: renderMd(item.content) }}
                        />
                      </ChatMessageBubble>
                      <MessageActionBar
                        align="start"
                        copyContent={speechText}
                        speechText={speechText}
                        speaking={isSpeaking(`msg-${i}`)}
                        speechSupported={speechSupported}
                        speechUnsupportedReason={speechUnsupportedReason}
                        onToggleSpeech={() => toggleSpeech(`msg-${i}`, speechText)}
                      />
                    </div>
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
                    <p className="font-medium">{m.console_chat_clarify_hint()}</p>
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

              {streamVisible && !recovering ? (
                streamText ? (
                  <div className="flex justify-start">
                    <div className="chat-bubble chat-bubble-assistant">
                      <div
                        className="md-content"
                        dangerouslySetInnerHTML={{ __html: renderMd(streamText) }}
                      />
                      <Spinner className="mt-1 size-3" />
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="chat-bubble chat-bubble-assistant text-muted-foreground flex items-center gap-2 text-sm">
                      <Spinner className="size-3" />
                      {m.console_chat_composing_reply()}
                    </div>
                  </div>
                )
              ) : null}

              {recovering ? (
                <div className="flex justify-start">
                  <div className="chat-bubble chat-bubble-assistant text-muted-foreground flex items-center gap-2 text-sm">
                    <Spinner className="size-3" />
                    {m.console_message_waiting_result()}
                  </div>
                </div>
              ) : null}
            </div>

            <div
              className={[
                "border-t border bg-background relative chat-compose",
                mobileLayout ? "px-3 py-2" : "p-4",
              ].join(" ")}
              style={
                keyboardInset > 0 ? { transform: `translateY(-${keyboardInset}px)` } : undefined
              }
            >
              {speechPlaybackError ? (
                <p className="mb-2 text-xs text-destructive">{speechPlaybackError}</p>
              ) : null}
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
                        {m.console_chat_queue_send_now()}
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
                <div
                  className={
                    cmdMenuInFlow ? "flex min-w-0 flex-1 flex-col" : "relative min-w-0 flex-1"
                  }
                >
                  {showCmdMenu ? (
                    <ul
                      className={[
                        "mb-1 max-h-48 overflow-y-auto rounded-lg border border bg-background shadow-lg",
                        cmdMenuInFlow
                          ? "relative z-10 shrink-0"
                          : "absolute bottom-full left-0 right-0 z-10",
                      ].join(" ")}
                    >
                      {filteredCommands.map((cmd, i) => (
                        <li
                          key={cmd.name}
                          className={[
                            "px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2 hover:bg-muted",
                            i === selectedCmdIdx ? "bg-primary/15" : "",
                          ].join(" ")}
                          onPointerDown={(e) => {
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
                    className="!min-h-9 h-9 max-h-48 w-full resize-none overflow-y-auto py-1.5 leading-5 [field-sizing:fixed]"
                    placeholder={m.console_chat_message_placeholder()}
                    disabled={writesDisabled}
                    onFocus={() => {
                      requestAnimationFrame(() => {
                        msgInputRef.current?.scrollIntoView({
                          block: "nearest",
                          behavior: "smooth",
                        });
                      });
                    }}
                    onKeyDown={onInputKeydown}
                  />
                </div>
                {streamVisible ? (
                  <Button type="submit" variant="destructive" disabled={writesDisabled}>
                    {m.console_common_stop()}
                  </Button>
                ) : (
                  <Button type="submit" disabled={!inputText.trim() || writesDisabled}>
                    {m.console_common_send()}
                  </Button>
                )}
              </form>
            </div>
          </ListDetailLayout>
        </div>
        <LlmDebugPanel
          open={debugViewerOpen}
          onClose={() => setDebugViewerOpen(false)}
          snapshots={llmDebugSnapshots}
        />
      </div>

      {convPointerMenu && conversationMenuItems.length > 0 ? (
        <ContextMenu
          x={convPointerMenu.x}
          y={convPointerMenu.y}
          items={conversationMenuItems}
          onClose={closeConversationMenu}
        />
      ) : null}

      {convSheetOpen && conversationMenuItems.length > 0 ? (
        <ActionSheet
          title={contextConversation ? conversationLabel(contextConversation) : undefined}
          items={conversationMenuItems}
          onClose={closeConversationMenu}
        />
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
            <DialogTitle>{m.console_common_edit_title()}</DialogTitle>
          </DialogHeader>
          <Input
            ref={renameInputRef}
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            type="text"
            className="text-sm"
            placeholder={m.console_common_title_placeholder()}
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
              {m.console_common_cancel()}
            </Button>
            <Button type="button" size="sm" onClick={() => void confirmRename()}>
              {m.console_common_confirm()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
