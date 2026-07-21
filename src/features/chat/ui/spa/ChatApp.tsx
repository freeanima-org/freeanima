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
} from "@freeanima/frontend/ui-kit";
import {
  ConfirmDialog,
  ActionSheet,
  ContextMenu,
  toast,
} from "@freeanima/frontend/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/frontend/ui-kit/composite";
import { AcpProgressDock } from "@freeanima/features/chat/ui/spa/components/AcpProgressDock.tsx";
import { SlashCommandResultPanel } from "@freeanima/features/chat/ui/spa/components/SlashCommandResultPanel.tsx";
import { ToolBlockBubble } from "@freeanima/features/chat/ui/spa/components/ToolBlockBubble.tsx";
import {
  ChatMessageBubble,
  findLastUserMessageIndex,
} from "@freeanima/features/chat/ui/spa/components/ChatMessageBubble.tsx";
import { openEntityResource } from "@freeanima/frontend/shell-ui/spa/features/open-entity-resource.ts";
import { ConversationListItem as ConversationListRow } from "@freeanima/features/chat/ui/spa/components/ConversationListItem.tsx";
import { useAcpProgressDock } from "@freeanima/features/chat/ui/spa/hooks/useAcpProgressDock.ts";
import { useEdgeSwipeOpen } from "@freeanima/features/chat/ui/spa/hooks/useEdgeSwipeOpen.ts";
import { useKeyboardInset } from "@freeanima/features/chat/ui/spa/hooks/useKeyboardInset.ts";
import { formatConversationIdDateTime } from "@freeanima/features/chat/ui/spa/lib/format-datetime.ts";
import {
  displayAwaitingReply,
  pollUntilAssistantReply,
} from "@freeanima/features/chat/ui/spa/lib/display-recovery.ts";
import { readPersistedActiveStream } from "@freeanima/features/chat/ui/spa/lib/active-stream-persist.ts";
import {
  fetchLlmDebug,
  listConversationCommands,
  loadConfig,
  rollbackBeforeLastUserMessage,
  runConversationCommand,
  subscribeConversationUpdates,
} from "@freeanima/features/chat/ui/spa/lib/api.ts";
import { runBootstrapConversation } from "@freeanima/features/chat/ui/spa/lib/bootstrap-conversation.ts";
import {
  ListDetailLayout,
  useDrawerNav,
  useCompactLayout,
} from "@freeanima/frontend/ui-kit/layout";
import { omitUndefined } from "@freeanima/core/util";
import {
  reconnectHabitat,
  useActionSheetCapability,
  useChatLlmDebugEnabled,
  useContextMenuCapability,
  useEnterToSendCapability,
  useHabitatConnection,
  useNetworkOnline,
  useOpenHabitatSettingsCapability,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { initAppLocale, m } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";
import { loadInputDraft, saveInputDraft } from "@freeanima/features/chat/ui/spa/lib/input-draft.ts";
import {
  getChatRpcStreamClient,
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
import { useChatStore } from "@freeanima/features/chat/ui/spa/stores/chat.ts";
import { useConversationsStore } from "@freeanima/features/chat/ui/spa/stores/conversations.ts";
import { useOutboxStore } from "@freeanima/features/chat/ui/spa/stores/outbox.ts";
import {
  claimChatSend,
  createEphemeralChatSend,
  listChatOutboxEntries,
  releaseChatSend,
} from "@freeanima/features/chat/ui/spa/lib/offline-send-store.ts";
import {
  buildChatStreamFlushContext,
  CHAT_OFFLINE_MODULE_ID,
  type ChatStreamFlushHandlers,
} from "@freeanima/features/chat/ui/spa/lib/offline-stream-adapter.ts";
import type { DisplayItem, StreamApiEvent } from "@freeanima/features/chat/ui/spa/lib/types.ts";
import { registerChatStreamContextFactory } from "@freeanima/frontend/shell-ui/spa/OfflineSyncBootstrap.tsx";
import { resolveOutboxScope } from "@freeanima/frontend/shell-sdk/offline-outbox";
import { flushOfflineModule } from "@freeanima/frontend/shell-sdk/offline-sync";
import { isRetriableOfflineWriteError } from "@freeanima/frontend/shell-sdk/prefer-online-write";
import {
  filterUndeliveredOutbox,
  isOutboxDeliveredOnDisplay,
  mergeOutboxStatusIntoDisplay,
  stripRedundantOptimisticDisplay,
} from "@freeanima/features/chat/ui/spa/lib/outbox-display-sync.ts";
import {
  buildSlashMenuEntries,
  type SlashCommandItem,
  type SlashMenuEntry,
} from "@freeanima/features/chat/ui/spa/lib/slash-command-menu.ts";

initAppLocale();

type CommandItem = SlashCommandItem;
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

function getSatelliteShell() {
  return window.satelliteShell;
}

function openHabitatSettingsIfAvailable(): void {
  getSatelliteShell()?.openHabitatSettings?.();
}

function isTransportFailureMessage(msg: string): boolean {
  return (
    /timed out|websocket|habitat_rpc_timeout|hub_rpc_timeout|网络错误/i.test(msg) ||
    isRetriableOfflineWriteError(new Error(msg))
  );
}

function buildSendOpts(
  sendMeta: SendDispatchOpts | undefined,
  llmDebug: boolean,
  onTailConflict: () => void,
) {
  return omitUndefined({
    llmDebug: llmDebug || undefined,
    clientOpId: sendMeta?.clientOpId,
    expectedTailPos: sendMeta?.expectedTailPos,
    forceTail: sendMeta?.forceTail,
    onTailConflict: sendMeta?.clientOpId ? onTailConflict : undefined,
  });
}

type SendDispatchOpts = {
  clientOpId?: string;
  expectedTailPos?: number;
  forceTail?: boolean;
  /** false = 在线直发未入 IDB；缺省 true = 已在 outbox */
  persisted?: boolean;
};

export function ChatApp() {
  const conversations = useConversationsStore((s) => s.conversations);
  const currentId = useConversationsStore((s) => s.currentId);
  const display = useConversationsStore((s) => s.display);
  const messagesLoading = useConversationsStore((s) => s.loading);
  const loadingOlder = useConversationsStore((s) => s.loadingOlder);
  const hasMoreBefore = useConversationsStore((s) => s.hasMoreBefore);
  const loadOlderMessages = useConversationsStore((s) => s.loadOlderMessages);
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
  const resolveExpectedTailPos = useConversationsStore((s) => s.resolveExpectedTailPos);
  const outboxEntries = useOutboxStore((s) => s.entries);
  const outboxAckEntry = useOutboxStore((s) => s.ackEntry);
  const outboxDiscard = useOutboxStore((s) => s.discard);
  const outboxUpdatePendingText = useOutboxStore((s) => s.updatePendingText);
  const outboxDetectStale = useOutboxStore((s) => s.detectStaleForConversation);
  const outboxHydrate = useOutboxStore((s) => s.hydrate);
  const outboxSetEntryStatus = useOutboxStore((s) => s.setEntryStatus);
  const patchDisplayByClientOpId = useConversationsStore((s) => s.patchDisplayByClientOpId);
  const removeDisplayByClientOpId = useConversationsStore((s) => s.removeDisplayByClientOpId);

  const renderMd = useChatStore((s) => s.renderMd);
  const streaming = useChatStore((s) => s.streaming);
  const streamingConversationId = useChatStore((s) => s.streamingConversationId);
  const streamText = useChatStore((s) => s.streamText);
  const recovering = useChatStore((s) => s.recovering);
  const send = useChatStore((s) => s.send);
  const resumeIfActive = useChatStore((s) => s.resumeIfActive);
  const queue = useChatStore((s) => s.queue);
  const messageQueue = useMemo(
    () => (currentId ? queue.filter((q) => q.conversationId === currentId) : []),
    [currentId, queue],
  );

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const canSendOnline = networkOnline && habitatConnection === "connected";
  const shellWritesDisabled = !networkOnline || habitatConnection !== "connected";
  const writesDisabled = shellWritesDisabled;
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
  const [editingOutboxOpId, setEditingOutboxOpId] = useState<string | null>(null);
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
  const [slashResult, setSlashResult] = useState<{
    command: string;
    text: string;
    loading?: boolean;
  } | null>(null);
  const llmDebugEnabled = useChatLlmDebugEnabled();
  const [debugViewerOpen, setDebugViewerOpen] = useState(false);
  const [llmDebugLoading, setLlmDebugLoading] = useState(false);
  const [llmDebugSnapshots, setLlmDebugSnapshots] = useState<LlmDebugSnapshots | null>(null);
  const pendingRecoveryKeyRef = useRef<string | null>(null);
  const mobileLayout = useCompactLayout();
  /** Enter 发送：仅交互维（pointer）；与布局/壳正交 */
  const enterToSend = useEnterToSendCapability();
  const canOpenHabitatSettingsUi = useOpenHabitatSettingsCapability();
  const useActionSheet = useActionSheetCapability();
  const contextMenuEnabled = useContextMenuCapability();
  const drawerNav = useDrawerNav();
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const edgeSwipeHandlers = useEdgeSwipeOpen({
    enabled: drawerNav && !sidebarOpen,
    onOpen: openSidebar,
  });
  const keyboardInset = useKeyboardInset();
  const {
    toggle: toggleSpeech,
    stop: stopSpeech,
    isSpeaking,
    isSupported: speechSupported,
    unsupportedReason: speechUnsupportedReason,
    playbackError: speechPlaybackError,
  } = useSpeechPlayback();

  const startReeditUserMessage = useCallback((index: number, content: string) => {
    setEditingOutboxOpId(null);
    setEditingUserIndex(index);
    setEditDraft(content);
  }, []);

  const startEditOutboxMessage = useCallback(
    (index: number, clientOpId: string, content: string) => {
      setEditingUserIndex(index);
      setEditingOutboxOpId(clientOpId);
      setEditDraft(content);
    },
    [],
  );

  const bootstrapConversation = useCallback(
    async (includeMemory = true) => {
      const fromUrl = readConversationFromUrl();
      const stored = readModuleSelection("chat");
      const memId = includeMemory ? useConversationsStore.getState().currentId : null;
      const result = await runBootstrapConversation({
        fetchConversations,
        whenReady: async () => {
          await getChatRpcStreamClient().whenReady();
        },
        createConversation: newConversationFn,
        selectConversation: async (conversationId) => {
          await selectConversation(conversationId);
          writeConversationToUrl(conversationId);
        },
        candidates: [fromUrl, stored, memId],
      });
      if (result === "created") {
        const createdId = useConversationsStore.getState().currentId;
        if (createdId) writeConversationToUrl(createdId);
      }
      void getChatRpcStreamClient()
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
    : m.habitat_chat_title();

  const acpDock = useAcpProgressDock(currentId, {
    patchProgress: patchProgressLine,
    onDecision: async (sid) => {
      const baseline = useConversationsStore.getState().display.length;
      await refreshMessages(sid, baseline);
    },
  });

  const INPUT_MIN_HEIGHT_PX = 36;
  const INPUT_MAX_HEIGHT_PX = 192;

  const slashMenuEntries = useMemo(
    () => buildSlashMenuEntries(inputText, commandList),
    [inputText, commandList],
  );

  const showCmdMenu = slashMenuEntries.length > 0;
  /** 窄视口/手机：菜单随输入区文档流展开，避免 absolute + 祖先 overflow-hidden 在软键盘顶起时被裁切 */
  const cmdMenuInFlow = mobileLayout;

  useEffect(() => {
    setSelectedCmdIdx((i) =>
      slashMenuEntries.length === 0 ? 0 : Math.min(i, slashMenuEntries.length - 1),
    );
  }, [slashMenuEntries]);

  const mergedDisplay = useMemo((): DisplayItem[] => {
    if (!currentId) return display;
    const cleaned = stripRedundantOptimisticDisplay(display);
    const conversationOutbox = Object.values(outboxEntries).filter(
      (e) => e.conversationId === currentId,
    );
    const synced = mergeOutboxStatusIntoDisplay(cleaned, conversationOutbox);
    const undelivered = filterUndeliveredOutbox(synced, conversationOutbox, currentId);
    const pendingOutbox = undelivered.map(
      (e): DisplayItem => ({
        type: "message",
        role: "user",
        content: e.text,
        clientOpId: e.clientOpId,
        sendStatus: e.status,
      }),
    );
    return [...synced, ...pendingOutbox];
  }, [currentId, display, outboxEntries]);

  /** 等待助手回复：流式中 / 恢复中 / 末条 user 后尚无 assistant（刷新后占位） */
  const awaitingAssistant =
    Boolean(currentId) &&
    (streamVisible ||
      recovering ||
      (!messagesLoading &&
        displayAwaitingReply(mergedDisplay) &&
        habitatConnection === "connected"));

  const pendingOutboxKey = useMemo(
    () =>
      Object.values(outboxEntries)
        .filter((e) => e.persisted !== false && (e.status === "pending" || e.status === "failed"))
        .map((e) => `${e.clientOpId}:${e.status}`)
        .toSorted()
        .join(","),
    [outboxEntries],
  );

  const lastUserMessageIndex = useMemo(
    () => findLastUserMessageIndex(mergedDisplay),
    [mergedDisplay],
  );

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

  const confirmEditOutboxMessage = async () => {
    const text = editDraft.trim();
    const clientOpId = editingOutboxOpId;
    if (!clientOpId || !text || sendingRef.current) return;
    const entry = useOutboxStore.getState().entries[clientOpId];
    if (!entry || entry.status === "sending" || entry.status === "stale") return;

    setEditingUserIndex(null);
    setEditingOutboxOpId(null);
    setEditDraft("");

    await outboxUpdatePendingText(clientOpId, text);
    patchDisplayByClientOpId(clientOpId, { content: text, sendStatus: "pending" });

    if (!canSendOnline) return;

    sendingRef.current = true;
    try {
      const updated = useOutboxStore.getState().entries[clientOpId];
      if (!updated || updated.status !== "pending") return;
      await dispatchSend(text, updated.conversationId, {
        clientOpId,
        expectedTailPos: updated.expectedTailPos,
      });
    } finally {
      sendingRef.current = false;
    }
  };

  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (habitatConnection === "disconnected") {
        await reconnectHabitat();
      }
      // 拆本地监听，保留 sessionStorage 中的 stream_id 供续传；先占位避免空白
      useChatStore.getState().abortStream();
      pendingRecoveryKeyRef.current = null;
      // abort 可能使进行中的 send() 稍后 settle；先松开发送锁，避免输入/发送无响应
      sendingRef.current = false;
      if (
        currentId &&
        (displayAwaitingReply(useConversationsStore.getState().display) ||
          readPersistedActiveStream(currentId))
      ) {
        useChatStore.setState({ recovering: true });
      }
      await fetchConversations();
      if (currentId) {
        await selectConversation(currentId);
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, habitatConnection, currentId, fetchConversations, selectConversation]);

  useEffect(() => {
    if (habitatConnection !== "connected") {
      // 拆监听；保留 sessionStorage，并清 recovery key 以便重连后重试 attach
      useChatStore.getState().abortStream();
      pendingRecoveryKeyRef.current = null;
      sendingRef.current = false;
    }
  }, [habitatConnection]);

  useEffect(() => subscribeShellConfigChanges(), []);

  useEffect(() => {
    void (async () => {
      try {
        await loadConfig();
        getChatRpcStreamClient();
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
    if (!ready) return;
    void listChatOutboxEntries().then((entries) => {
      outboxHydrate(entries);
    });
  }, [ready, outboxHydrate]);

  useEffect(() => {
    if (!currentId) return;
    const orphans = Object.values(outboxEntries).filter(
      (entry) =>
        entry.conversationId === currentId && isOutboxDeliveredOnDisplay(display, entry.text),
    );
    if (orphans.length === 0) return;
    for (const entry of orphans) {
      void outboxAckEntry(entry.clientOpId);
    }
  }, [currentId, display, outboxEntries, outboxAckEntry]);

  useEffect(() => {
    if (habitatConnection !== "connected") return;
    void fetchConversations();
  }, [habitatConnection, fetchConversations]);

  useEffect(() => {
    stopSpeech();
  }, [currentId, stopSpeech]);

  useEffect(() => {
    if (!llmDebugEnabled) {
      setDebugViewerOpen(false);
      setLlmDebugSnapshots(null);
    }
  }, [llmDebugEnabled]);

  /** 打开调试面板时再拉取 Redis 缓存（按会话） */
  useEffect(() => {
    if (!debugViewerOpen || !llmDebugEnabled || !currentId) return;
    let cancelled = false;
    setLlmDebugLoading(true);
    void fetchLlmDebug(currentId)
      .then((data) => {
        if (cancelled) return;
        setLlmDebugSnapshots({
          ...(data.initial ? { initial: data.initial } : {}),
          ...(data.final ? { final: data.final } : {}),
        });
      })
      .catch(() => {
        if (!cancelled) setLlmDebugSnapshots(null);
      })
      .finally(() => {
        if (!cancelled) setLlmDebugLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debugViewerOpen, llmDebugEnabled, currentId]);

  useEffect(() => {
    const el = msgAreaRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 96;
      stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      if (el.scrollTop < threshold && hasMoreBefore && !loadingOlder && !messagesLoading) {
        const prevHeight = el.scrollHeight;
        void loadOlderMessages().then((didLoad) => {
          if (!didLoad) return;
          requestAnimationFrame(() => {
            const area = msgAreaRef.current;
            if (!area) return;
            area.scrollTop += area.scrollHeight - prevHeight;
          });
        });
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [currentId, hasMoreBefore, loadingOlder, messagesLoading, loadOlderMessages]);

  /** 首屏内容不足一屏时继续向上取，直到撑满或无更早消息 */
  useEffect(() => {
    const el = msgAreaRef.current;
    if (!el || !currentId || messagesLoading || loadingOlder || !hasMoreBefore) return;
    if (el.scrollHeight > el.clientHeight + 8) return;
    void loadOlderMessages();
  }, [currentId, display.length, hasMoreBefore, loadingOlder, messagesLoading, loadOlderMessages]);

  useEffect(() => {
    if (!currentId) return;
    writeConversationToUrl(currentId);
    writeModuleSelection("chat", currentId);
    setInputText(loadInputDraft(currentId));
    setSlashResult(null);
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
    const sub = subscribeConversationUpdates(currentId, () => {
      void fetchConversations();
    });
    return () => sub.unsubscribe();
  }, [currentId, fetchConversations]);

  /** 刷新 / 整页刷新 / 切回会话：先 stream.lookup/attach 续传，否则轮询落库 */
  useEffect(() => {
    if (!currentId) return;
    if (habitatConnection !== "connected") return;
    if (streaming && streamingConversationId === currentId) return;

    const awaiting = displayAwaitingReply(display);
    const persisted = Boolean(readPersistedActiveStream(currentId));
    if (!awaiting && !persisted) {
      pendingRecoveryKeyRef.current = null;
      return;
    }

    const key = `${currentId}@${display.length}@${persisted ? "p" : "n"}@connected`;
    if (pendingRecoveryKeyRef.current === key) return;
    pendingRecoveryKeyRef.current = key;

    const baseline = display.length;
    let cancelled = false;
    useChatStore.setState({ recovering: true });

    const sub = subscribeConversationUpdates(currentId, () => {
      void refreshMessages(currentId, baseline);
    });

    const originId = currentId;
    const isViewingOrigin = () => useConversationsStore.getState().currentId === originId;
    // 不用下方的 scrollDown：本 effect 在其声明之前，避免 TDZ
    const scrollResume = () => {
      requestAnimationFrame(() => {
        const el = msgAreaRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    };

    void (async () => {
      const resumed = await resumeIfActive(originId, {
        recoverDisplay: (id) => refreshMessages(id, baseline),
        onToken: () => {
          if (isViewingOrigin()) scrollResume();
        },
        onDisplayAppend: (item) => {
          appendItemForConversation(originId, item);
          if (isViewingOrigin()) scrollResume();
        },
        onAwaitingClarify: (data) => {
          if (!isViewingOrigin()) return;
          if (Array.isArray(data.items) && data.items.length > 0) {
            setClarifyPending({
              items: data.items as ClarifyPending["items"],
              timeout_sec: (data.timeout_sec as number | undefined) ?? 1800,
            });
          }
          scrollResume();
        },
        onError: (msg) => {
          if (!isViewingOrigin()) return;
          appendItemForConversation(originId, {
            type: "message",
            role: "assistant",
            content: `⚠️ ${msg}`,
          });
          scrollResume();
        },
        onDone: (opts) => {
          if (opts?.recovered) {
            if (isViewingOrigin()) scrollResume();
            return;
          }
          void reloadConversationIfCurrent(originId);
          void fetchConversations();
          if (isViewingOrigin()) scrollResume();
        },
      });
      if (cancelled) return;
      if (resumed) return;
      if (!awaiting) {
        useChatStore.setState({ recovering: false });
        return;
      }
      // attach 失败：保持「正在生成」占位，继续轮询落库
      useChatStore.setState({ recovering: true });
      await pollUntilAssistantReply(originId, (id) => refreshMessages(id, baseline));
    })().finally(() => {
      if (cancelled) return;
      // 仍在流式时由 resumeIfActive 自己清 recovering
      if (!useChatStore.getState().streaming) {
        useChatStore.setState({ recovering: false });
      }
    });

    return () => {
      cancelled = true;
      sub.unsubscribe();
      // 不在 cleanup 清 recovering：lookup 异步期间 display 变化会重跑 effect，
      // 清掉会导致「正在撰写」占位闪没；由新 effect / finally / resumeIfActive 接管。
    };
  }, [
    currentId,
    display,
    streaming,
    streamingConversationId,
    habitatConnection,
    refreshMessages,
    resumeIfActive,
    appendItemForConversation,
    reloadConversationIfCurrent,
    fetchConversations,
  ]);

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

  const applyMenuEntry = (entry: SlashMenuEntry) => {
    setInputText(entry.insertText);
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
        { label: m.habitat_common_rename(), onClick: startRename },
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
  const chatFlushHandlersRef = useRef<ChatStreamFlushHandlers>({
    onStreamEvent: () => {},
    onDone: () => {},
    onError: () => {},
  });

  const syncOutboxFromIdb = useCallback(async () => {
    const idbEntries = await listChatOutboxEntries();
    const idbIds = new Set(idbEntries.map((e) => e.clientOpId));
    for (const opId of Object.keys(useOutboxStore.getState().entries)) {
      if (!idbIds.has(opId)) {
        const mem = useOutboxStore.getState().entries[opId];
        // 在线直发 ephemeral：尚未入 IDB，勿当孤儿清掉
        if (mem?.persisted === false) continue;
        removeDisplayByClientOpId(opId);
        await outboxAckEntry(opId);
        continue;
      }
      const idbEntry = idbEntries.find((e) => e.clientOpId === opId);
      if (idbEntry?.status === "failed") {
        patchDisplayByClientOpId(opId, { sendStatus: "failed" });
        outboxSetEntryStatus(opId, "failed", idbEntry.lastError);
      }
    }
  }, [outboxAckEntry, outboxSetEntryStatus, patchDisplayByClientOpId, removeDisplayByClientOpId]);

  useEffect(() => {
    chatFlushHandlersRef.current = {
      onStreamEvent: (conversationId: string, ev: unknown) => {
        const streamEv = ev as StreamApiEvent;
        if (useConversationsStore.getState().currentId !== conversationId) return;
        switch (streamEv.event) {
          case "accepted":
            useChatStore.setState({ streaming: true, streamingConversationId: conversationId });
            break;
          case "token": {
            const prev = useChatStore.getState().streamText;
            useChatStore.setState({
              streaming: true,
              streamingConversationId: conversationId,
              streamText: prev + (streamEv.data.content || ""),
            });
            scrollDown();
            break;
          }
          case "content_replace":
            useChatStore.setState({
              streaming: true,
              streamingConversationId: conversationId,
              streamText: streamEv.data.content || "",
            });
            scrollDown();
            break;
          case "display_append":
            appendItemForConversation(conversationId, streamEv.data.item);
            if (streamEv.data.item.type === "message" && streamEv.data.item.role === "assistant") {
              useChatStore.setState({ streamText: "" });
            }
            scrollDown();
            break;
          case "awaiting_clarify":
            if (Array.isArray(streamEv.data.items) && streamEv.data.items.length > 0) {
              setClarifyPending({
                items: streamEv.data.items as ClarifyPending["items"],
                timeout_sec: (streamEv.data.timeout_sec as number | undefined) ?? 1800,
              });
            }
            scrollDown();
            break;
          case "done":
          case "interrupted":
            useChatStore.setState({
              streaming: false,
              streamingConversationId: null,
              streamText: "",
            });
            break;
          default:
            break;
        }
      },
      onDone: (conversationId: string) => {
        void syncOutboxFromIdb();
        void reloadConversationIfCurrent(conversationId);
        void fetchConversations();
        useChatStore.setState({
          streaming: false,
          streamingConversationId: null,
          streamText: "",
        });
      },
      onError: (conversationId: string, msg: string) => {
        for (const entry of Object.values(useOutboxStore.getState().entries)) {
          if (entry.conversationId === conversationId && entry.status === "sending") {
            patchDisplayByClientOpId(entry.clientOpId, { sendStatus: "failed" });
            outboxSetEntryStatus(entry.clientOpId, "failed", msg);
          }
        }
        void syncOutboxFromIdb();
      },
      llmDebug: llmDebugEnabled,
    };
    registerChatStreamContextFactory(() => {
      if (!canSendOnline) return null;
      return buildChatStreamFlushContext(chatFlushHandlersRef.current);
    });
    return () => registerChatStreamContextFactory(() => null);
  }, [
    appendItemForConversation,
    canSendOnline,
    fetchConversations,
    llmDebugEnabled,
    outboxSetEntryStatus,
    patchDisplayByClientOpId,
    reloadConversationIfCurrent,
    syncOutboxFromIdb,
  ]);

  const dispatchSend = useCallback(
    async (text: string, originConversationId: string, sendMeta?: SendDispatchOpts) => {
      const displayBaseline = useConversationsStore.getState().display.length;
      if (clarifyPending) setClarifyPending(null);
      scrollDown();

      const isViewingOrigin = () =>
        useConversationsStore.getState().currentId === originConversationId;

      const inOutbox = sendMeta?.persisted !== false;
      if (sendMeta?.clientOpId) {
        if (inOutbox) {
          claimChatSend(sendMeta.clientOpId);
        }
        patchDisplayByClientOpId(sendMeta.clientOpId, { sendStatus: "sending" });
        outboxSetEntryStatus(sendMeta.clientOpId, "sending");
      }

      try {
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
              const opId = sendMeta?.clientOpId;
              if (opId) {
                const entry = useOutboxStore.getState().entries[opId];
                if (entry?.status !== "stale") {
                  const transport = isTransportFailureMessage(msg);
                  const persistThenFail = async () => {
                    if (sendMeta.persisted === false && transport) {
                      await useOutboxStore.getState().persistToIdb(opId);
                    }
                    patchDisplayByClientOpId(opId, { sendStatus: "failed" });
                    outboxSetEntryStatus(opId, "failed", msg);
                  };
                  void persistThenFail();
                }
              }
              if (opId && useOutboxStore.getState().entries[opId]?.status === "stale") {
                if (isViewingOrigin()) scrollDown();
                return;
              }
              appendItemForConversation(originConversationId, {
                type: "message",
                role: "assistant",
                content: `⚠️ ${msg}`,
              });
              if (isTransportFailureMessage(msg)) {
                void reconnectHabitat().catch(() => undefined);
              }
              if (isViewingOrigin()) scrollDown();
            },
            onDone: (opts) => {
              if (sendMeta?.clientOpId) {
                removeDisplayByClientOpId(sendMeta.clientOpId);
                void outboxAckEntry(sendMeta.clientOpId);
              }
              if (opts?.recovered) {
                if (isViewingOrigin()) scrollDown();
                void flushQueueRef.current(originConversationId);
                return;
              }
              void reloadConversationIfCurrent(originConversationId);
              void fetchConversations();
              if (isViewingOrigin()) scrollDown();
              void flushQueueRef.current(originConversationId);
              // 面板已打开时补拉最新缓存（发送过程不推流）
              if (llmDebugEnabled && debugViewerOpen && isViewingOrigin()) {
                void fetchLlmDebug(originConversationId).then((data) => {
                  setLlmDebugSnapshots({
                    ...(data.initial ? { initial: data.initial } : {}),
                    ...(data.final ? { final: data.final } : {}),
                  });
                });
              }
            },
          },
          buildSendOpts(sendMeta, llmDebugEnabled, () => {
            const opId = sendMeta?.clientOpId;
            if (!opId) return;
            void (async () => {
              if (sendMeta.persisted === false) {
                await useOutboxStore.getState().persistToIdb(opId);
              }
              patchDisplayByClientOpId(opId, { sendStatus: "stale" });
              outboxSetEntryStatus(opId, "stale");
            })();
          }),
        );
      } finally {
        if (sendMeta?.clientOpId && inOutbox) {
          releaseChatSend(sendMeta.clientOpId);
        }
      }
    },
    [
      appendItemForConversation,
      clarifyPending,
      debugViewerOpen,
      llmDebugEnabled,
      outboxAckEntry,
      outboxSetEntryStatus,
      patchDisplayByClientOpId,
      removeDisplayByClientOpId,
      refreshMessages,
      reloadConversationIfCurrent,
      fetchConversations,
      send,
    ],
  );

  useEffect(() => {
    if (!canSendOnline || !ready || !pendingOutboxKey) return;
    if (sendingRef.current) return;

    void (async () => {
      const pending = Object.values(useOutboxStore.getState().entries).filter(
        (e) => e.persisted !== false && (e.status === "pending" || e.status === "failed"),
      );
      const conversationIds = [...new Set(pending.map((e) => e.conversationId))];
      for (const conversationId of conversationIds) {
        const staleIds = await outboxDetectStale(conversationId);
        for (const opId of staleIds) {
          patchDisplayByClientOpId(opId, { sendStatus: "stale" });
        }
      }

      const stillPending = Object.values(useOutboxStore.getState().entries).filter(
        (e) => e.persisted !== false && (e.status === "pending" || e.status === "failed"),
      );
      if (stillPending.length === 0 || sendingRef.current) return;

      for (const entry of stillPending) {
        patchDisplayByClientOpId(entry.clientOpId, { sendStatus: "sending" });
        outboxSetEntryStatus(entry.clientOpId, "sending");
      }

      await flushOfflineModule(CHAT_OFFLINE_MODULE_ID, resolveOutboxScope(), {
        streamContext: buildChatStreamFlushContext(chatFlushHandlersRef.current),
      });
      await syncOutboxFromIdb();
    })();
  }, [
    canSendOnline,
    ready,
    pendingOutboxKey,
    outboxDetectStale,
    outboxSetEntryStatus,
    patchDisplayByClientOpId,
    syncOutboxFromIdb,
  ]);

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
  const showOfflineCachedHint =
    shellWritesDisabled && (conversations.length > 0 || display.length > 0);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || sendingRef.current) return;

    let conversationId = currentId;
    if (!conversationId) {
      if (!canSendOnline) return;
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

    // 在任何 await 之前上锁，避免弱网下连点/Enter 越过守卫。
    sendingRef.current = true;
    const originConversationId = conversationId;
    let claimedOpId: string | null = null;
    try {
      if (text.startsWith("/") && canSendOnline) {
        setInputText("");
        saveInputDraft(originConversationId, "");
        requestAnimationFrame(resizeInput);
        const cmdName = text.slice(1).split(/\s+/).filter(Boolean)[0] ?? "";
        setSlashResult({ command: cmdName, text: "", loading: true });
        try {
          const result = await runConversationCommand(originConversationId, text);
          if (result.delivery === "message") {
            // 续流型（/retry、/goal <描述>）：改走 message.send
            setSlashResult(null);
          } else if (result.delivery === "rpc") {
            if (result.ux === "panel") {
              setSlashResult({ command: result.command, text: result.text });
            } else if (result.ux === "toast") {
              setSlashResult(null);
              toast(result.text, { duration: 4000 });
            } else {
              setSlashResult(null);
            }
            return;
          } else {
            setSlashResult(null);
            toast("Unexpected slash command response", { duration: 5000 });
            return;
          }
        } catch (e) {
          setSlashResult(null);
          toast(e instanceof Error ? e.message : String(e), { duration: 5000 });
          return;
        }
      }

      const expectedTailPos = await resolveExpectedTailPos(originConversationId, canSendOnline);

      if (!text.startsWith("/") || !canSendOnline) {
        setInputText("");
        saveInputDraft(originConversationId, "");
        requestAnimationFrame(resizeInput);
      }

      if (canSendOnline) {
        // 在线栖息地优先：内存 clientOpId + 直发，不入 IDB outbox
        const entry = createEphemeralChatSend(originConversationId, text, expectedTailPos);
        useOutboxStore.getState().trackLocal(entry);
        appendItem({
          type: "message",
          role: "user",
          content: text,
          clientOpId: entry.clientOpId,
          sendStatus: "pending",
        });
        await dispatchSend(text, originConversationId, {
          clientOpId: entry.clientOpId,
          expectedTailPos: entry.expectedTailPos,
          persisted: false,
        });
      } else {
        const entry = await useOutboxStore
          .getState()
          .enqueue(originConversationId, text, expectedTailPos);
        claimChatSend(entry.clientOpId);
        claimedOpId = entry.clientOpId;
        appendItem({
          type: "message",
          role: "user",
          content: text,
          clientOpId: entry.clientOpId,
          sendStatus: "pending",
        });
      }
    } finally {
      if (claimedOpId) releaseChatSend(claimedOpId);
      sendingRef.current = false;
    }
  };

  const sendQueuedNow = async (queueId: string) => {
    if (!currentId || sendingRef.current) return;
    const item = useChatStore.getState().takeQueued(queueId);
    if (!item || item.conversationId !== currentId) return;

    sendingRef.current = true;
    try {
      if (item.text.startsWith("/") && canSendOnline) {
        const cmdName = item.text.slice(1).split(/\s+/).filter(Boolean)[0] ?? "";
        setSlashResult({ command: cmdName, text: "", loading: true });
        try {
          const result = await runConversationCommand(item.conversationId, item.text);
          if (result.delivery === "message") {
            setSlashResult(null);
          } else if (result.delivery === "rpc") {
            if (result.ux === "panel") {
              setSlashResult({ command: result.command, text: result.text });
            } else if (result.ux === "toast") {
              setSlashResult(null);
              toast(result.text, { duration: 4000 });
            } else {
              setSlashResult(null);
            }
            return;
          } else {
            setSlashResult(null);
            toast("Unexpected slash command response", { duration: 5000 });
            return;
          }
        } catch (e) {
          setSlashResult(null);
          toast(e instanceof Error ? e.message : String(e), { duration: 5000 });
          return;
        }
      }

      appendItemForConversation(item.conversationId, {
        type: "message",
        role: "user",
        content: item.text,
      });
      scrollDown();
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
        setSelectedCmdIdx((i) => Math.min(i + 1, slashMenuEntries.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCmdIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        const entry = slashMenuEntries[selectedCmdIdx];
        if (entry) applyMenuEntry(entry);
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
          <h2 className="text-lg font-bold">{m.habitat_chat_title()}</h2>
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground">
            {getSatelliteShell()?.habitatWsUrl
              ? canOpenHabitatSettingsUi
                ? "请确认栖息地已运行，或在设置中检查栖息地地址。"
                : "请确认栖息地已运行（anima service start）。"
              : "请确认栖息地已运行，且 chat dev server 提供 /config.json。"}
          </p>
          {canOpenHabitatSettingsUi ? (
            <Button type="button" size="sm" onClick={openHabitatSettingsIfAvailable}>
              连接设置
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
          aria-label={m.habitat_common_refresh()}
          onClick={() => void handleManualRefresh()}
        >
          {refreshing ? <Spinner className="size-3.5" /> : m.habitat_common_refresh()}
        </Button>
        <Button
          type="button"
          size="sm"
          className={`h-7 px-2 ${drawerNav ? "" : "hidden"}`}
          onClick={startConversation}
        >
          {m.habitat_common_new_conversation()}
        </Button>
        {canOpenHabitatSettingsUi ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={openHabitatSettingsIfAvailable}
          >
            Habitat
          </Button>
        ) : null}
        {llmDebugEnabled ? (
          <Button
            type="button"
            variant={debugViewerOpen ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            disabled={!currentId || llmDebugLoading}
            onClick={() => {
              if (debugViewerOpen) {
                setDebugViewerOpen(false);
                return;
              }
              setDebugViewerOpen(true);
            }}
          >
            {llmDebugLoading ? m.chat_llm_debug_loading() : m.chat_llm_debug_view()}
          </Button>
        ) : null}
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
                    {m.habitat_common_new_conversation()}
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

            {slashResult ? (
              <div className="shrink-0 px-4 pt-3">
                <SlashCommandResultPanel
                  command={slashResult.command}
                  text={slashResult.text}
                  {...(slashResult.loading ? { loading: true } : {})}
                  onClose={() => setSlashResult(null)}
                  renderMd={renderMd}
                />
              </div>
            ) : null}

            <div
              ref={msgAreaRef}
              className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 space-y-4"
            >
              {currentId && loadingOlder ? (
                <div className="flex justify-center py-2">
                  <Spinner className="size-4" />
                </div>
              ) : null}
              {!currentId ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-foreground/40 text-sm">
                  <p>{m.habitat_chat_select_conversation()}</p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={writesDisabled}
                    onClick={startConversation}
                  >
                    {m.habitat_common_new_conversation()}
                  </Button>
                </div>
              ) : messagesLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner className="size-6" />
                </div>
              ) : display.length === 0 && !awaitingAssistant ? (
                <div className="flex items-center justify-center h-full text-foreground/40 text-sm">
                  {m.habitat_chat_send_first_message()}
                </div>
              ) : null}

              {mergedDisplay.map((item, i) => {
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
                                setEditingOutboxOpId(null);
                                setEditDraft("");
                              }}
                            >
                              {m.habitat_common_cancel()}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7"
                              disabled={
                                !editDraft.trim() || (editingOutboxOpId ? false : writesDisabled)
                              }
                              onClick={() =>
                                void (editingOutboxOpId
                                  ? confirmEditOutboxMessage()
                                  : confirmReeditUserMessage())
                              }
                            >
                              {m.habitat_common_confirm()}
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
                        className={`chat-bubble-user whitespace-pre-wrap${
                          item.sendStatus === "pending" || item.sendStatus === "sending"
                            ? " opacity-70"
                            : item.sendStatus === "stale" || item.sendStatus === "failed"
                              ? " border border-warning"
                              : ""
                        }`}
                      >
                        {item.content}
                        {item.sendStatus === "pending" ? (
                          <p className="mt-1 text-xs opacity-70">{m.ui_outbox_pending()}</p>
                        ) : null}
                        {item.sendStatus === "stale" ? (
                          <>
                            <p className="mt-1 text-xs text-warning">{m.ui_outbox_stale()}</p>
                            <p className="text-xs text-warning/80">{m.ui_outbox_stale_hint()}</p>
                          </>
                        ) : null}
                        {item.sendStatus === "failed" ? (
                          <p className="mt-1 text-xs text-warning">{m.ui_outbox_failed()}</p>
                        ) : null}
                      </ChatMessageBubble>
                      {item.clientOpId &&
                      (item.sendStatus === "pending" ||
                        item.sendStatus === "failed" ||
                        item.sendStatus === "stale") ? (
                        <div className="mt-1 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const opId = item.clientOpId;
                              if (!opId) return;
                              void outboxDiscard(opId).then(() => {
                                removeDisplayByClientOpId(opId);
                              });
                            }}
                          >
                            {m.ui_outbox_discard()}
                          </Button>
                          {item.sendStatus === "stale" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const opId = item.clientOpId;
                                if (!opId || !currentId) return;
                                void (async () => {
                                  sendingRef.current = true;
                                  try {
                                    await dispatchSend(item.content, currentId, {
                                      clientOpId: opId,
                                      expectedTailPos: outboxEntries[opId]?.expectedTailPos ?? 0,
                                      forceTail: true,
                                    });
                                  } finally {
                                    sendingRef.current = false;
                                  }
                                })();
                              }}
                            >
                              {m.ui_outbox_force_send()}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      <MessageActionBar
                        align="end"
                        copyContent={item.content}
                        speechText={item.content}
                        speaking={isSpeaking(`msg-${i}`)}
                        speechSupported={speechSupported}
                        speechUnsupportedReason={speechUnsupportedReason}
                        onToggleSpeech={() => toggleSpeech(`msg-${i}`, item.content)}
                        {...(item.clientOpId &&
                        (item.sendStatus === "pending" || item.sendStatus === "failed")
                          ? {
                              onEdit: () => {
                                const opId = item.clientOpId;
                                if (!opId) return;
                                startEditOutboxMessage(i, opId, item.content);
                              },
                            }
                          : i === lastUserMessageIndex && !item.sendStatus
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
                          onClick={(e) => {
                            const target = e.target as HTMLElement | null;
                            const anchor = target?.closest?.(
                              "a[data-anima-uri]",
                            ) as HTMLAnchorElement | null;
                            if (!anchor) return;
                            e.preventDefault();
                            const uri = anchor.getAttribute("data-anima-uri");
                            if (uri) void openEntityResource(uri);
                          }}
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
                    <p className="font-medium">{m.habitat_chat_clarify_hint()}</p>
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

              {awaitingAssistant ? (
                streamVisible && streamText ? (
                  <div className="flex justify-start">
                    <div className="chat-bubble chat-bubble-assistant">
                      <div
                        className="md-content"
                        dangerouslySetInnerHTML={{ __html: renderMd(streamText) }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement | null;
                          const anchor = target?.closest?.(
                            "a[data-anima-uri]",
                          ) as HTMLAnchorElement | null;
                          if (!anchor) return;
                          e.preventDefault();
                          const uri = anchor.getAttribute("data-anima-uri");
                          if (uri) void openEntityResource(uri);
                        }}
                      />
                      <Spinner className="mt-1 size-3" />
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="chat-bubble chat-bubble-assistant text-muted-foreground flex items-center gap-2 text-sm">
                      <Spinner className="size-3" />
                      {recovering && !streamVisible
                        ? m.habitat_message_waiting_result()
                        : m.habitat_chat_composing_reply()}
                    </div>
                  </div>
                )
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
                        {m.habitat_chat_queue_send_now()}
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
                      {slashMenuEntries.map((entry, i) => (
                        <li
                          key={entry.label}
                          className={[
                            "px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2 hover:bg-muted",
                            i === selectedCmdIdx ? "bg-primary/15" : "",
                          ].join(" ")}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            applyMenuEntry(entry);
                          }}
                        >
                          <span className="font-mono font-medium shrink-0">{entry.label}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {entry.description}
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
                    placeholder={m.habitat_chat_message_placeholder()}
                    disabled={streamVisible}
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
                  <Button type="submit" variant="destructive" disabled={!canSendOnline}>
                    {m.habitat_common_stop()}
                  </Button>
                ) : (
                  <Button type="submit" disabled={!inputText.trim()}>
                    {m.habitat_common_send()}
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
          loading={llmDebugLoading}
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
            <DialogTitle>{m.habitat_common_edit_title()}</DialogTitle>
          </DialogHeader>
          <Input
            ref={renameInputRef}
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            type="text"
            className="text-sm"
            placeholder={m.habitat_common_title_placeholder()}
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
              {m.habitat_common_cancel()}
            </Button>
            <Button type="button" size="sm" onClick={() => void confirmRename()}>
              {m.habitat_common_confirm()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
