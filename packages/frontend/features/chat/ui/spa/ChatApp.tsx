import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
  Textarea,
  Toggle,
} from "@freeanima/ui-kit";
import { ConfirmDialog, ActionSheet, ModalSheetPresent, toast } from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";
import { SlashCommandResultPanel } from "@freeanima/features/chat/ui/spa/components/SlashCommandResultPanel.tsx";
import { ConversationTranscript } from "@freeanima/features/chat/ui/spa/components/ConversationTranscript.tsx";
import { ChatComposeForm } from "@freeanima/features/chat/ui/spa/components/ChatComposeForm.tsx";
import type { ChatComposeSendPayload } from "@freeanima/features/chat/ui/spa/components/ChatComposeForm.tsx";
import { ChatContextUsageButton } from "@freeanima/features/chat/ui/spa/components/ChatContextUsage.tsx";
import { uploadChatAttachmentDrafts } from "@freeanima/features/chat/ui/spa/lib/attachments.ts";
import type { TranscriptScrollApi } from "@freeanima/features/chat/ui/spa/hooks/useStickToBottomScroll.ts";
import { openEntityResource } from "@freeanima/client/portal-sdk/open-entity-resource.ts";
import { ConversationListItem as ConversationListRow } from "@freeanima/features/chat/ui/spa/components/ConversationListItem.tsx";
import { ConversationAnimaControl } from "@freeanima/features/chat/ui/spa/components/ConversationAnimaControl.tsx";
import {
  listAgentSubjects,
  type AgentSubjectOption,
} from "@freeanima/features/chat/ui/spa/lib/agent-subjects.ts";
import { useEdgeSwipeOpen } from "@freeanima/features/chat/ui/spa/hooks/useEdgeSwipeOpen.ts";
import { useKeyboardInset } from "@freeanima/features/chat/ui/spa/hooks/useKeyboardInset.ts";
import {
  composeKeyboardLift,
  measureAppBottomNavChromePx,
} from "@freeanima/features/chat/ui/spa/lib/keyboard-inset.ts";
import { formatConversationIdDateTime } from "@freeanima/features/chat/ui/spa/lib/format-datetime.ts";
import {
  displayAwaitingReply,
  resolveStalledAfterLookup,
  shouldShowAwaitingPlaceholder,
} from "@freeanima/features/chat/ui/spa/lib/display-recovery.ts";
import {
  readPersistedActiveStream,
  clearPersistedActiveStream,
} from "@freeanima/features/chat/ui/spa/lib/active-stream-persist.ts";
import {
  createConversationShare,
  fetchLlmDebug,
  listConversationCommands,
  loadConfig,
  lookupActiveStream,
  rollbackBeforeLastUserMessage,
  runConversationCommand,
  subscribeConversationUpdates,
  subscribeConversationInbox,
  type ConversationShareTtl,
} from "@freeanima/features/chat/ui/spa/lib/api.ts";
import { useChatUnreadStore } from "@freeanima/features/chat/ui/spa/stores/chat-unread.ts";
import { useViewportConversationRead } from "@freeanima/features/chat/ui/spa/hooks/use-viewport-conversation-read.ts";
import { runBootstrapConversation } from "@freeanima/features/chat/ui/spa/lib/bootstrap-conversation.ts";
import { ListDetailLayout, useDrawerNav, useCompactLayout } from "@freeanima/ui-kit/layout";
import { asRecord, omitUndefined } from "@freeanima/shared/util";
import {
  reconnectHabitat,
  useActionSheetCapability,
  useChatLlmDebugEnabled,
  useCompactImmersive,
  useContextMenuCapability,
  useHabitatConnection,
  useNetworkOnline,
  useOpenHabitatSettingsCapability,
  useSetCompactImmersive,
  shouldUseNativeShellNavigation,
} from "@freeanima/client/portal-sdk/react.tsx";
import {
  getChatRpcStreamClient,
  subscribeShellConfigChanges,
} from "@freeanima/features/chat/ui/spa/lib/habitat-stream-client.ts";
import { LlmDebugPanel } from "@freeanima/features/chat/ui/spa/components/LlmDebugPanel.tsx";
import type {
  ConversationListItem,
  LlmDebugSnapshots,
} from "@freeanima/features/chat/ui/spa/lib/types.ts";
import {
  readModuleSelection,
  subscribeSubjectKind,
  writeModuleSelection,
} from "@freeanima/client/portal-sdk";
import { useSpeechPlayback } from "@freeanima/features/chat/ui/spa/hooks/useSpeechPlayback.ts";
import { useStreamAutoSpeak } from "@freeanima/features/chat/ui/spa/hooks/useStreamAutoSpeak.ts";
import { primeHabitatSpeechOutput } from "@freeanima/client/portal-sdk/speech/habitat-adapter";
import {
  loadAutoSpeakPref,
  saveAutoSpeakPref,
} from "@freeanima/features/chat/ui/spa/lib/speech/auto-speak-pref.ts";
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
import { registerChatStreamContextFactory } from "@freeanima/client/portal-sdk/chat-stream-context.ts";
import { resolveOutboxScope } from "@freeanima/client/portal-sdk/offline-outbox";
import { flushOfflineModule } from "@freeanima/client/portal-sdk/offline-sync";
import { isRetriableOfflineWriteError } from "@freeanima/client/portal-sdk/prefer-online-write";
import {
  filterUndeliveredOutbox,
  isOutboxDeliveredOnDisplay,
  mergeOutboxStatusIntoDisplay,
  stripRedundantOptimisticDisplay,
} from "@freeanima/features/chat/ui/spa/lib/outbox-display-sync.ts";
import type { SlashCommandItem } from "@freeanima/features/chat/ui/spa/lib/slash-command-menu.ts";

type CommandItem = SlashCommandItem;

function readCommandList(raw: unknown): CommandItem[] {
  const rec = asRecord(raw);
  const commands = rec?.commands;
  if (!Array.isArray(commands)) return [];
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- commands 列表契约边界
  return commands as CommandItem[];
}

function readClarifyTimeoutSec(v: unknown): number {
  return typeof v === "number" ? v : 1800;
}

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

function getPortalShell() {
  return window.portalShell;
}

function openHabitatSettingsIfAvailable(): void {
  getPortalShell()?.openHabitatSettings?.();
}

const SHARE_TTL_OPTIONS: Array<{ value: ConversationShareTtl; label: string }> = [
  { value: "1h", label: "1 小时" },
  { value: "1d", label: "1 天" },
  { value: "1w", label: "1 周" },
  { value: "1mo", label: "1 个月" },
];

function absoluteShareUrl(urlPath: string): string {
  if (shouldUseNativeShellNavigation()) {
    const base = window.location.href.split("#")[0] ?? window.location.origin;
    return `${base}#${urlPath}`;
  }
  const raw = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");
  const basepath = raw && raw !== "." && raw.startsWith("/") ? raw : "";
  return `${window.location.origin}${basepath}${urlPath}`;
}

function resolveShareCopyUrl(result: { url?: string; url_path: string }): string {
  const absolute = result.url?.trim();
  if (absolute) return absolute;
  return absoluteShareUrl(result.url_path);
}

function isTransportFailureMessage(msg: string): boolean {
  return (
    /timed out|websocket|habitat_rpc_timeout|habitat_rpc_timeout|网络错误/i.test(msg) ||
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
    attachmentTempIds: sendMeta?.attachmentTempIds,
    attachments: sendMeta?.attachments,
    onTailConflict: sendMeta?.clientOpId ? onTailConflict : undefined,
  });
}

type SendDispatchOpts = {
  clientOpId?: string;
  expectedTailPos?: number;
  forceTail?: boolean;
  /** false = 在线直发未入 IDB；缺省 true = 已在 outbox */
  persisted?: boolean;
  attachmentTempIds?: string[];
  attachments?: Array<{ filename: string; mime_type: string; size: number }>;
};

export function ChatApp() {
  const conversations = useConversationsStore((s) => s.conversations);
  const currentId = useConversationsStore((s) => s.currentId);
  const display = useConversationsStore((s) => s.display);
  const messagesLoading = useConversationsStore((s) => s.loading);
  const loadingOlder = useConversationsStore((s) => s.loadingOlder);
  const hasMoreBefore = useConversationsStore((s) => s.hasMoreBefore);
  const billedUsage = useConversationsStore((s) => s.billedUsage);
  const contextUsage = useConversationsStore((s) => s.contextUsage);
  const loadOlderMessages = useConversationsStore((s) => s.loadOlderMessages);
  const fetchConversations = useConversationsStore((s) => s.fetchConversations);
  const selectConversation = useConversationsStore((s) => s.selectConversation);
  const newConversationFn = useConversationsStore((s) => s.newConversation);
  const setConversationAgentFn = useConversationsStore((s) => s.setConversationAgent);
  const renameConversation = useConversationsStore((s) => s.renameConversation);
  const showArchived = useConversationsStore((s) => s.showArchived);
  const setShowArchived = useConversationsStore((s) => s.setShowArchived);
  const archiveConversationFn = useConversationsStore((s) => s.archiveConversation);
  const unarchiveConversationFn = useConversationsStore((s) => s.unarchiveConversation);
  const pinConversationFn = useConversationsStore((s) => s.pinConversation);
  const unpinConversationFn = useConversationsStore((s) => s.unpinConversation);
  const deleteConversationFn = useConversationsStore((s) => s.deleteConversation);
  const appendItem = useConversationsStore((s) => s.appendItem);
  const appendItemForConversation = useConversationsStore((s) => s.appendItemForConversation);
  const refreshMessages = useConversationsStore((s) => s.refreshMessages);
  const reloadConversationIfCurrent = useConversationsStore((s) => s.reloadConversationIfCurrent);
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
  const recoveringConversationId = useChatStore((s) => s.recoveringConversationId);
  const userStoppedIds = useChatStore((s) => s.userStoppedIds);
  const send = useChatStore((s) => s.send);
  const continueTurn = useChatStore((s) => s.continueTurn);
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
  /** 展示未完成且后端无 active 流：出【继续】，不伪装等待 */
  const [stalledReply, setStalledReply] = useState(false);
  /** 在线报错维：与 stalled 正交，错误气泡之外仍可【继续】 */
  const [offerContinue, setOfferContinue] = useState(false);

  const sendingRef = useRef(false);
  const msgAreaRef = useRef<HTMLDivElement>(null);
  const scrollApiRef = useRef<TranscriptScrollApi | null>(null);
  const readSentinelRef = useViewportConversationRead(currentId, display.length, msgAreaRef);

  const [commandList, setCommandList] = useState<CommandItem[]>([]);
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
  const [autoSpeak, setAutoSpeak] = useState(() => loadAutoSpeakPref());
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareTtl, setShareTtl] = useState<ConversationShareTtl>("1h");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareResultUrl, setShareResultUrl] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPosSet, setSelectedPosSet] = useState<Set<number>>(() => new Set());
  const [selectionShareTtl, setSelectionShareTtl] = useState<ConversationShareTtl>("1h");
  const [selectionShareBusy, setSelectionShareBusy] = useState(false);
  const [agentOptions, setAgentOptions] = useState<AgentSubjectOption[]>([]);
  const [animaChanging, setAnimaChanging] = useState(false);
  const pendingRecoveryKeyRef = useRef<string | null>(null);
  const mobileLayout = useCompactLayout();
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
  const compactImmersive = useCompactImmersive();
  const setCompactImmersive = useSetCompactImmersive();
  const keyboardOwnedImmersiveRef = useRef(false);
  /** 键盘打开时藏 compact 底栏，避免占位与 translateY 错位；与任务沉浸编辑共用 store，仅清理本方占用 */
  useLayoutEffect(() => {
    if (!mobileLayout) {
      if (keyboardOwnedImmersiveRef.current) {
        setCompactImmersive(false);
        keyboardOwnedImmersiveRef.current = false;
      }
      return;
    }
    if (keyboardInset > 0) {
      if (!keyboardOwnedImmersiveRef.current) {
        setCompactImmersive(true);
        keyboardOwnedImmersiveRef.current = true;
      }
      return;
    }
    if (keyboardOwnedImmersiveRef.current) {
      setCompactImmersive(false);
      keyboardOwnedImmersiveRef.current = false;
    }
  }, [mobileLayout, keyboardInset, setCompactImmersive]);
  useEffect(
    () => () => {
      if (!keyboardOwnedImmersiveRef.current) return;
      setCompactImmersive(false);
      keyboardOwnedImmersiveRef.current = false;
    },
    [setCompactImmersive],
  );
  const bottomChromePx = mobileLayout && !compactImmersive ? measureAppBottomNavChromePx() : 0;
  const composeLift = composeKeyboardLift(keyboardInset, bottomChromePx);
  const {
    toggle: toggleSpeech,
    enqueue: enqueueSpeech,
    stop: stopSpeech,
    isSpeaking,
    isSupported: speechSupported,
    unsupportedReason: speechUnsupportedReason,
    playbackError: speechPlaybackError,
    activeKey: speechActiveKey,
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
        .then((raw) => setCommandList(readCommandList(raw)))
        .catch((e) => console.error("commands:", e));
    },
    [fetchConversations, newConversationFn, selectConversation],
  );

  const streamVisible = streaming && streamingConversationId === currentId;
  const recoveringHere = recovering && recoveringConversationId === currentId;
  const userStoppedHere = Boolean(currentId && userStoppedIds.includes(currentId));

  const { stopCurrentKeepEnabled, isStreamSpeaking } = useStreamAutoSpeak({
    enabled: autoSpeak && speechSupported,
    currentId,
    streamVisible,
    streamText,
    enqueue: enqueueSpeech,
    stop: stopSpeech,
    activeKey: speechActiveKey,
  });

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
    setConvSheetOpen(false);
  }, []);

  const openConversationMenu = useCallback((conversationId: string) => {
    setMenuConversationId(conversationId);
    setConvSheetOpen(true);
  }, []);

  const headerTitle = currentId
    ? conversationLabel(
        currentConversation ?? {
          id: currentId,
          title: "",
          created: "",
          platform: "",
        },
      )
    : "聊天室";

  const mergedDisplay = useMemo((): DisplayItem[] => {
    if (!currentId) return display;
    const cleaned = stripRedundantOptimisticDisplay(display);
    const conversationOutbox = Object.values(outboxEntries).filter(
      (e) => e.conversationId === currentId,
    );
    const synced = mergeOutboxStatusIntoDisplay(cleaned, conversationOutbox);
    const undelivered = filterUndeliveredOutbox(synced, conversationOutbox, currentId);
    const pendingOutbox = undelivered.map((e): DisplayItem => ({
      type: "message",
      role: "user",
      content: e.text,
      clientOpId: e.clientOpId,
      sendStatus: e.status,
    }));
    return [...synced, ...pendingOutbox];
  }, [currentId, display, outboxEntries]);

  const hasUserMessage = useMemo(
    () => mergedDisplay.some((item) => item.type === "message" && item.role === "user"),
    [mergedDisplay],
  );

  const canChangeAnima = Boolean(currentId) && !messagesLoading && !hasUserMessage;

  const handleChangeAnima = useCallback(
    async (agentSubjectId: number) => {
      if (!currentId) return;
      setAnimaChanging(true);
      try {
        await setConversationAgentFn(currentId, agentSubjectId);
      } finally {
        setAnimaChanging(false);
      }
    },
    [currentId, setConversationAgentFn],
  );

  /** 等待助手回复：流式中 / 恢复中；stalled 或用户停止时不占位（改出【继续】） */
  const awaitingAssistant = shouldShowAwaitingPlaceholder({
    currentId,
    stalledReply,
    streamVisible,
    recovering,
    recoveringConversationId,
    messagesLoading,
    displayAwaiting: displayAwaitingReply(mergedDisplay),
    habitatConnected: habitatConnection === "connected",
    userStopped: userStoppedHere,
  });

  const showContinueButton =
    Boolean(currentId) &&
    !streaming &&
    !recoveringHere &&
    !writesDisabled &&
    canSendOnline &&
    (stalledReply || offerContinue || userStoppedHere);

  const pendingOutboxKey = useMemo(
    () =>
      Object.values(outboxEntries)
        .filter((e) => e.persisted !== false && (e.status === "pending" || e.status === "failed"))
        .map((e) => `${e.clientOpId}:${e.status}`)
        .toSorted()
        .join(","),
    [outboxEntries],
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
      scrollApiRef.current?.stick();
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
      // recovering 由恢复 effect 在确认仍有 active 流后再置位，避免 stalled 误显「等待结果…」
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
    if (!ready) return () => {};
    return subscribeSubjectKind(() => {
      void bootstrapConversation(false).catch((e) => console.error("chat subject bootstrap:", e));
    });
  }, [ready, bootstrapConversation]);

  useEffect(() => {
    if (!ready) return;
    void listAgentSubjects()
      .then((items) => setAgentOptions(items))
      .catch((e) => console.error("listAgentSubjects:", e));
  }, [ready]);

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

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedPosSet(new Set());
    setSelectionShareBusy(false);
  }, []);

  const toggleSelectPos = useCallback((pos: number) => {
    setSelectedPosSet((prev) => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos);
      else next.add(pos);
      return next;
    });
  }, []);

  const runCreateShare = useCallback(
    async (opts: { ttl: ConversationShareTtl; posList?: number[] }) => {
      if (!currentId) return null;
      const result = await createConversationShare({
        conversationId: currentId,
        ttl: opts.ttl,
        ...(opts.posList?.length ? { posList: opts.posList } : {}),
      });
      return resolveShareCopyUrl(result);
    },
    [currentId],
  );

  const handleShareEntireConversation = useCallback(async () => {
    if (!currentId || shareBusy) return;
    setShareBusy(true);
    setShareResultUrl(null);
    try {
      const url = await runCreateShare({ ttl: shareTtl });
      if (!url) return;
      setShareResultUrl(url);
      const copied = await copyText(url);
      toast(copied ? "分享链接已复制" : "分享链接已生成", { duration: 3000 });
    } catch (e) {
      toast(e instanceof Error ? e.message : "分享失败", { duration: 4000 });
    } finally {
      setShareBusy(false);
    }
  }, [currentId, runCreateShare, shareBusy, shareTtl]);

  const handleShareSelectedMessages = useCallback(async () => {
    if (!currentId || selectionShareBusy || selectedPosSet.size === 0) return;
    setSelectionShareBusy(true);
    try {
      const url = await runCreateShare({
        ttl: selectionShareTtl,
        posList: Array.from(selectedPosSet).toSorted((a, b) => a - b),
      });
      if (!url) return;
      const copied = await copyText(url);
      toast(copied ? "分享链接已复制" : "分享链接已生成", { duration: 3000 });
      exitSelectionMode();
    } catch (e) {
      toast(e instanceof Error ? e.message : "分享失败", { duration: 4000 });
    } finally {
      setSelectionShareBusy(false);
    }
  }, [
    currentId,
    exitSelectionMode,
    runCreateShare,
    selectedPosSet,
    selectionShareBusy,
    selectionShareTtl,
  ]);

  useEffect(() => {
    exitSelectionMode();
    setShareSheetOpen(false);
    setShareResultUrl(null);
  }, [currentId, exitSelectionMode]);

  useEffect(() => {
    if (!llmDebugEnabled) {
      setDebugViewerOpen(false);
      setLlmDebugSnapshots(null);
    }
  }, [llmDebugEnabled]);

  /** 打开调试面板时再拉取 Redis 缓存（按会话） */
  useEffect(() => {
    if (!debugViewerOpen || !llmDebugEnabled || !currentId) return () => {};
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
    if (!currentId) return;
    writeConversationToUrl(currentId);
    writeModuleSelection("chat", currentId);
    setSlashResult(null);
    requestAnimationFrame(() => {
      scrollApiRef.current?.scrollDown({ force: true });
    });
  }, [currentId]);

  useEffect(() => {
    if (!currentId) return () => {};
    const sub = subscribeConversationUpdates(currentId, () => {
      void fetchConversations();
    });
    return () => sub.unsubscribe();
  }, [currentId, fetchConversations]);

  useEffect(() => {
    const sub = subscribeConversationInbox((conversationId) => {
      const viewing = useConversationsStore.getState().currentId;
      // 当前会话已有 subscribeConversationUpdates 刷新列表；此处再拉会重复请求
      if (viewing !== conversationId) {
        void fetchConversations();
      }
      void useChatUnreadStore.getState().refreshCount();
    });
    return () => sub.unsubscribe();
  }, [fetchConversations]);

  /** 刷新 / 切回会话：lookup 有 active 则 resume；否则先同步 display 再决定 stalled */
  useEffect(() => {
    if (!currentId) {
      setStalledReply(false);
      return () => {};
    }
    if (habitatConnection !== "connected") return () => {};
    if (streaming && streamingConversationId === currentId) return () => {};

    const awaiting = displayAwaitingReply(display);
    const persisted = Boolean(readPersistedActiveStream(currentId));
    if (!awaiting && !persisted) {
      pendingRecoveryKeyRef.current = null;
      setStalledReply(false);
      useChatStore.getState().setRecovering(currentId, false);
      return () => {};
    }

    const key = `${currentId}@${display.length}@${persisted ? "p" : "n"}@connected`;
    if (pendingRecoveryKeyRef.current === key) return () => {};
    pendingRecoveryKeyRef.current = key;

    const baseline = display.length;
    let cancelled = false;
    const originId = currentId;

    const clearRecoveringIfOrigin = () => {
      const s = useChatStore.getState();
      if (s.streamingConversationId === originId) return;
      s.setRecovering(originId, false);
    };

    const sub = subscribeConversationUpdates(currentId, () => {
      void refreshMessages(currentId, baseline);
    });

    const isViewingOrigin = () => useConversationsStore.getState().currentId === originId;
    const scrollResume = () => {
      scrollApiRef.current?.scrollDown({ force: true });
    };

    const applyStalledFromSyncedDisplay = async () => {
      clearPersistedActiveStream(originId);
      try {
        await reloadConversationIfCurrent(originId);
      } catch (e) {
        console.error("reload before stalled decision failed:", e);
      }
      if (cancelled) return;
      const stillAwaiting = displayAwaitingReply(useConversationsStore.getState().display);
      setStalledReply(
        resolveStalledAfterLookup({
          awaitingAfterSync: stillAwaiting,
          streaming: useChatStore.getState().streaming,
          hasActiveStream: false,
        }),
      );
      clearRecoveringIfOrigin();
    };

    if (useChatStore.getState().wasUserStopped(originId)) {
      void applyStalledFromSyncedDisplay();
      return () => {
        cancelled = true;
        sub.unsubscribe();
      };
    }

    // 核实期用 recovering 占位，勿乐观 stalled（本地 display 可能滞后于已完成的后端）
    if (awaiting) {
      setStalledReply(false);
      useChatStore.getState().setRecovering(originId, true);
    }

    void (async () => {
      let looked: { stream_id?: string; status?: string } = {};
      try {
        looked = await lookupActiveStream(originId);
      } catch (e) {
        console.error("stream.lookup failed:", e);
      }
      if (cancelled) return;

      // 仅服务端 active 算 alive；sessionStorage 过期 id 在 Habitat 重启后不可信
      const serverActive = typeof looked.stream_id === "string" && looked.stream_id.length > 0;
      if (!serverActive) {
        await applyStalledFromSyncedDisplay();
        return;
      }

      setStalledReply(false);
      useChatStore.getState().setRecovering(originId, true);
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
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- clarify items 契约边界
              items: data.items as ClarifyPending["items"],
              timeout_sec: readClarifyTimeoutSec(data.timeout_sec),
            });
          }
          scrollResume();
        },
        onError: (msg) => {
          setOfferContinue(true);
          if (!isViewingOrigin()) return;
          appendItemForConversation(originId, {
            type: "message",
            role: "assistant",
            content: `⚠️ ${msg}`,
          });
          scrollResume();
        },
        onDone: (opts) => {
          setOfferContinue(false);
          setStalledReply(false);
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
      if (resumed) {
        setStalledReply(false);
        return;
      }

      // lookup 曾有 active 但 resume 失败（竞态）：同步后再判 stalled
      await applyStalledFromSyncedDisplay();
    })().finally(() => {
      if (cancelled) return;
      clearRecoveringIfOrigin();
    });

    return () => {
      cancelled = true;
      sub.unsubscribe();
      clearRecoveringIfOrigin();
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
    scrollApiRef.current?.scrollDown(opts);
  };

  const navigateToConversation = async (conversationId: string) => {
    if (conversationId === currentId) {
      setSidebarOpen(false);
      return;
    }
    setClarifyPending(null);
    setStalledReply(false);
    setOfferContinue(false);
    await selectConversation(conversationId);
    setSidebarOpen(false);
  };

  const newConversation = async () => {
    const id = await newConversationFn();
    if (id) {
      writeConversationToUrl(id);
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

  const startRename = (id: string) => {
    const s = conversations.find((x) => x.id === id);
    setMenuConversationId(id);
    setRenameText((s && s.title) || "");
    setShowRenameDialog(true);
    setConvSheetOpen(false);
    requestAnimationFrame(() => renameInputRef.current?.focus());
  };

  const confirmRename = async () => {
    const title = renameText.trim();
    if (title && menuConversationId) {
      await renameConversation(menuConversationId, title);
    }
    setShowRenameDialog(false);
    setRenameText("");
    setMenuConversationId(null);
  };

  const startDelete = (id: string) => {
    setDeleteTargetId(id);
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

  const handleArchive = async (id: string) => {
    closeConversationMenu();
    const nextId = await archiveConversationFn(id);
    writeConversationToUrl(nextId);
  };

  const handleUnarchive = async (id: string) => {
    closeConversationMenu();
    await unarchiveConversationFn(id);
  };

  const handlePin = async (id: string) => {
    closeConversationMenu();
    await pinConversationFn(id);
  };

  const handleUnpin = async (id: string) => {
    closeConversationMenu();
    await unpinConversationFn(id);
  };

  const toggleShowArchived = () => {
    void setShowArchived(!showArchived);
  };

  const conversationMenuItemsFor = (id: string): ActionSheetItem[] => {
    const conv = conversations.find((s) => s.id === id);
    return [
      { label: "✏️ 重命名", onClick: () => startRename(id) },
      ...(conv?.pinnedAt
        ? [{ label: "取消置顶", onClick: () => void handleUnpin(id) }]
        : [{ label: "置顶", onClick: () => void handlePin(id) }]),
      ...(conv?.archivedAt
        ? [{ label: "取消归档", onClick: () => void handleUnarchive(id) }]
        : [{ label: "归档", onClick: () => void handleArchive(id) }]),
      {
        label: "删除",
        danger: true,
        onClick: () => startDelete(id),
      },
    ];
  };

  const conversationMenuItems: ActionSheetItem[] = menuConversationId
    ? conversationMenuItemsFor(menuConversationId)
    : [];

  const renderConversationItem = (s: ConversationListItem, faded = false) => (
    <ConversationListRow
      key={s.id}
      conversation={s}
      label={conversationLabel(s)}
      active={s.id === currentId}
      faded={faded}
      unread={s.unread === true}
      useActionSheet={useActionSheet}
      contextMenuEnabled={contextMenuEnabled}
      contextMenuItems={conversationMenuItemsFor(s.id)}
      onNavigate={(id) => void navigateToConversation(id)}
      onOpenMenu={openConversationMenu}
      onArchive={(id) => void handleArchive(id)}
      onUnarchive={(id) => void handleUnarchive(id)}
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
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- stream 事件契约边界
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
                items: streamEv.data.items,
                timeout_sec: streamEv.data.timeout_sec ?? 1800,
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
        void useChatUnreadStore.getState().refreshCount();
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
                  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- clarify items 契约边界
                  items: data.items as ClarifyPending["items"],
                  timeout_sec: readClarifyTimeoutSec(data.timeout_sec),
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
              setOfferContinue(true);
              if (isTransportFailureMessage(msg)) {
                void reconnectHabitat().catch(() => undefined);
              }
              if (isViewingOrigin()) scrollDown();
            },
            onDone: (opts) => {
              setOfferContinue(false);
              setStalledReply(false);
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

  const dispatchContinue = useCallback(async () => {
    if (!currentId || sendingRef.current || writesDisabled || !canSendOnline) return;
    const originConversationId = currentId;
    sendingRef.current = true;
    setStalledReply(false);
    setOfferContinue(false);
    const displayBaseline = useConversationsStore.getState().display.length;
    const isViewingOrigin = () =>
      useConversationsStore.getState().currentId === originConversationId;
    try {
      await continueTurn(
        originConversationId,
        {
          recoverDisplay: (id) => refreshMessages(id, displayBaseline),
          onToken: () => {
            if (isViewingOrigin()) scrollDown();
          },
          onDisplayAppend: (item) => {
            appendItemForConversation(originConversationId, item);
            if (isViewingOrigin()) scrollDown();
          },
          onAwaitingClarify: (data) => {
            if (!isViewingOrigin()) return;
            if (Array.isArray(data.items) && data.items.length > 0) {
              setClarifyPending({
                // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- clarify items 契约边界
                items: data.items as ClarifyPending["items"],
                timeout_sec: readClarifyTimeoutSec(data.timeout_sec),
              });
            }
            scrollDown();
          },
          onError: (msg) => {
            setOfferContinue(true);
            appendItemForConversation(originConversationId, {
              type: "message",
              role: "assistant",
              content: `⚠️ ${msg}`,
            });
            if (isViewingOrigin()) scrollDown();
          },
          onDone: (opts) => {
            setOfferContinue(false);
            setStalledReply(false);
            if (opts?.recovered) {
              if (isViewingOrigin()) scrollDown();
              return;
            }
            void reloadConversationIfCurrent(originConversationId);
            void fetchConversations();
            if (isViewingOrigin()) scrollDown();
          },
        },
        { llmDebug: llmDebugEnabled },
      );
    } finally {
      sendingRef.current = false;
    }
  }, [
    appendItemForConversation,
    canSendOnline,
    continueTurn,
    currentId,
    fetchConversations,
    llmDebugEnabled,
    refreshMessages,
    reloadConversationIfCurrent,
    writesDisabled,
  ]);

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

  const offlineCachedHint = " · 显示缓存数据";
  const showOfflineCachedHint =
    shellWritesDisabled && (conversations.length > 0 || display.length > 0);

  const sendMessage = async (payload: ChatComposeSendPayload) => {
    const text = payload.text.trim();
    const drafts = payload.drafts;
    if ((!text && drafts.length === 0) || sendingRef.current) return;

    let conversationId = currentId;
    if (!conversationId) {
      if (!canSendOnline) return;
      conversationId = await ensureConversation();
      if (!conversationId) return;
    }

    if (streamVisible) {
      if (drafts.length > 0) {
        toast("流式回复中无法排队附件，请稍后再发", { duration: 4000 });
        return;
      }
      useChatStore.getState().enqueue(conversationId, text);
      return;
    }

    // 在任何 await 之前上锁，避免弱网下连点/Enter 越过守卫。
    sendingRef.current = true;
    const originConversationId = conversationId;
    let claimedOpId: string | null = null;
    try {
      if (text.startsWith("/") && canSendOnline && drafts.length === 0) {
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

      let attachmentTempIds: string[] | undefined;
      let attachments: Array<{ filename: string; mime_type: string; size: number }> | undefined;
      let previewAttachments:
        | Array<{
            filename: string;
            mime_type: string;
            size: number;
            previewUrl?: string;
          }>
        | undefined;
      if (drafts.length > 0) {
        if (!canSendOnline) {
          toast("离线时无法发送附件", { duration: 4000 });
          return;
        }
        try {
          const uploaded = await uploadChatAttachmentDrafts(drafts);
          attachmentTempIds = uploaded.tempIds;
          attachments = uploaded.attachments;
          previewAttachments = drafts.map((d, i) => ({
            filename: uploaded.attachments[i]?.filename ?? d.filename,
            mime_type: uploaded.attachments[i]?.mime_type ?? d.mime_type,
            size: uploaded.attachments[i]?.size ?? d.size,
            ...(d.previewUrl ? { previewUrl: d.previewUrl } : {}),
          }));
        } catch (e) {
          toast(e instanceof Error ? e.message : String(e), { duration: 5000 });
          return;
        }
      }

      const expectedTailPos = await resolveExpectedTailPos(originConversationId, canSendOnline);

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
          ...(previewAttachments?.length ? { attachments: previewAttachments } : {}),
        });
        await dispatchSend(text, originConversationId, {
          clientOpId: entry.clientOpId,
          expectedTailPos: entry.expectedTailPos,
          persisted: false,
          ...(attachmentTempIds?.length ? { attachmentTempIds } : {}),
          ...(attachments?.length ? { attachments } : {}),
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
          <h2 className="text-lg font-bold">{"聊天室"}</h2>
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground">
            {getPortalShell()?.habitatWsUrl
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
        {currentId ? (
          <ConversationAnimaControl
            {...(currentConversation?.agentSubjectId != null
              ? { agentSubjectId: currentConversation.agentSubjectId }
              : {})}
            {...(currentConversation?.agentTitle
              ? { agentTitle: currentConversation.agentTitle }
              : {})}
            agents={agentOptions}
            canChange={canChangeAnima}
            changing={animaChanging}
            onChange={(id) => void handleChangeAnima(id)}
            className="max-w-[40%] shrink"
          />
        ) : null}
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2"
          isDisabled={refreshing || !ready}
          aria-label={"刷新"}
          onClick={() => void handleManualRefresh()}
        >
          {refreshing ? <Spinner className="size-3.5" /> : "刷新"}
        </Button>
        <Toggle
          size="sm"
          className="shrink-0 px-2"
          isSelected={autoSpeak}
          isDisabled={!speechSupported}
          aria-label={autoSpeak ? "自动朗读已开" : "自动朗读已关"}
          title={
            !speechSupported
              ? speechUnsupportedReason === "insecure_context"
                ? "Web Speech 需要 HTTPS；请使用 Edge TTS，或通过 HTTPS 打开服务"
                : "此设备不支持语音朗读"
              : undefined
          }
          onPointerDown={() => {
            if (speechSupported) primeHabitatSpeechOutput();
          }}
          onChange={(next) => {
            saveAutoSpeakPref(next);
            setAutoSpeak(next);
          }}
        >
          {"朗读"}
        </Toggle>
        <Button
          type="button"
          size="sm"
          className={`h-7 px-2 ${drawerNav ? "" : "hidden"}`}
          onClick={startConversation}
        >
          {"＋ 新会话"}
        </Button>
        <Button
          type="button"
          variant={selectionMode || shareSheetOpen ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2"
          isDisabled={!currentId}
          onClick={() => {
            if (selectionMode) {
              exitSelectionMode();
              return;
            }
            setShareResultUrl(null);
            setShareSheetOpen(true);
          }}
        >
          {"分享"}
        </Button>
        {llmDebugEnabled ? (
          <Button
            type="button"
            variant={debugViewerOpen ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            isDisabled={!currentId || llmDebugLoading}
            onClick={() => {
              if (debugViewerOpen) {
                setDebugViewerOpen(false);
                return;
              }
              setDebugViewerOpen(true);
            }}
          >
            {llmDebugLoading ? "Loading debug snapshot…" : "调试"}
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
                    {"＋ 新会话"}
                  </Button>
                  <label className="text-muted-foreground flex cursor-pointer select-none items-center gap-2 px-1 text-xs">
                    <Checkbox
                      className="size-3.5"
                      isSelected={showArchived}
                      onChange={() => toggleShowArchived()}
                    />
                    {"显示已归档"}
                  </label>
                </div>
                <div className="flex-1 space-y-1 overflow-y-auto px-2 py-1">
                  {activeConversations.map((s) => renderConversationItem(s))}
                  {showArchived && archivedConversations.length > 0 ? (
                    <div className="border/60 mt-2 space-y-1 border-t pt-2">
                      <div className="text-muted-foreground px-1 text-[11px] font-medium tracking-wide uppercase">
                        {"已归档"}
                      </div>
                      {archivedConversations.map((s) => renderConversationItem(s, true))}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          >
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

            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <ConversationTranscript
                display={mergedDisplay}
                conversationKey={currentId}
                scrollContainerRef={msgAreaRef}
                scrollApiRef={scrollApiRef}
                readSentinelRef={readSentinelRef}
                streamText={streamText}
                streaming={awaitingAssistant}
                streamVisible={streamVisible}
                recovering={recoveringHere}
                loadingOlder={loadingOlder}
                hasMoreBefore={hasMoreBefore}
                messagesLoading={messagesLoading}
                onLoadOlder={loadOlderMessages}
                selectionMode={selectionMode}
                selectedPosSet={selectedPosSet}
                onToggleSelectPos={toggleSelectPos}
                onAnimaUriClick={(uri) => {
                  void openEntityResource(uri).then((r) => {
                    if (!r.ok) toast(r.error, { duration: 4000 });
                  });
                }}
                speech={{
                  supported: speechSupported,
                  unsupportedReason: speechUnsupportedReason,
                  isSpeaking,
                  toggle: toggleSpeech,
                  stopKeepEnabled: stopCurrentKeepEnabled,
                  isStreamSpeaking,
                }}
                canEditUser={(i, item) => {
                  if (
                    item.clientOpId &&
                    (item.sendStatus === "pending" || item.sendStatus === "failed")
                  ) {
                    return true;
                  }
                  if (item.sendStatus) return false;
                  for (let j = mergedDisplay.length - 1; j >= 0; j--) {
                    const row = mergedDisplay[j];
                    if (row?.type === "message" && row.role === "user") return j === i;
                  }
                  return false;
                }}
                onEditUser={(i, item) => {
                  if (
                    item.clientOpId &&
                    (item.sendStatus === "pending" || item.sendStatus === "failed")
                  ) {
                    startEditOutboxMessage(i, item.clientOpId, item.content);
                    return;
                  }
                  startReeditUserMessage(i, item.content);
                }}
                renderUserMessage={({ index: i }) => {
                  if (editingUserIndex !== i) return null;
                  return (
                    <div className="flex justify-end min-w-0 max-w-full">
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
                            {"取消"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7"
                            isDisabled={
                              !editDraft.trim() || (editingOutboxOpId ? false : writesDisabled)
                            }
                            onClick={() =>
                              void (editingOutboxOpId
                                ? confirmEditOutboxMessage()
                                : confirmReeditUserMessage())
                            }
                          >
                            {"确定"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }}
                renderAfterUser={({ item }) => {
                  if (
                    !item.clientOpId ||
                    (item.sendStatus !== "pending" &&
                      item.sendStatus !== "failed" &&
                      item.sendStatus !== "stale")
                  ) {
                    return null;
                  }
                  return (
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
                        {"丢弃"}
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
                          {"仍然发送"}
                        </Button>
                      ) : null}
                    </div>
                  );
                }}
                empty={
                  !currentId ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-foreground/40 text-sm">
                      <p>{"选择一个会话开始对话"}</p>
                      <Button
                        type="button"
                        size="sm"
                        isDisabled={writesDisabled}
                        onClick={startConversation}
                      >
                        {"＋ 新会话"}
                      </Button>
                    </div>
                  ) : display.length === 0 && !awaitingAssistant ? (
                    <div className="flex items-center justify-center h-full text-foreground/40 text-sm">
                      {"发送第一条消息"}
                    </div>
                  ) : null
                }
                loading={
                  <div className="flex h-full items-center justify-center">
                    <Spinner className="size-6" />
                  </div>
                }
                footer={
                  clarifyPending ? (
                    <Alert variant="info" className="shadow-sm">
                      <AlertDescription className="w-full space-y-2">
                        <p className="font-medium">
                          {"需要你确认（一条消息回复全部，或发送 /cancel）"}
                        </p>
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
                  ) : null
                }
              />
              <div className="pointer-events-none absolute right-2 bottom-2 z-10">
                <div className="pointer-events-auto">
                  <ChatContextUsageButton context={contextUsage} usage={billedUsage} />
                </div>
              </div>
            </div>

            <div
              className={[
                "border-t border bg-background relative chat-compose",
                mobileLayout ? "px-3 py-2" : "p-4",
              ].join(" ")}
              style={composeLift > 0 ? { transform: `translateY(-${composeLift}px)` } : undefined}
            >
              {selectionMode ? (
                <div className="flex flex-col gap-2">
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="radiogroup"
                    aria-label="链接有效期"
                  >
                    <span className="text-muted-foreground text-xs">有效期</span>
                    {SHARE_TTL_OPTIONS.map((opt) => (
                      <Toggle
                        key={opt.value}
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        isSelected={selectionShareTtl === opt.value}
                        onChange={(selected) => {
                          if (selected) setSelectionShareTtl(opt.value);
                        }}
                      >
                        {opt.label}
                      </Toggle>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="ghost" onPress={exitSelectionMode}>
                      {"取消"}
                    </Button>
                    <span className="text-muted-foreground flex-1 text-xs">
                      {`已选 ${selectedPosSet.size} 条`}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      isDisabled={selectedPosSet.size === 0 || selectionShareBusy}
                      onPress={() => void handleShareSelectedMessages()}
                    >
                      {selectionShareBusy ? "生成中…" : "分享所选"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {showContinueButton ? (
                    <div className="mb-2 flex justify-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shadow-sm"
                        isDisabled={streaming}
                        onClick={() => void dispatchContinue()}
                      >
                        {"继续"}
                      </Button>
                    </div>
                  ) : null}
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
                            {"立即发送"}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <ChatComposeForm
                    conversationId={currentId}
                    commandList={commandList}
                    menuInFlow={mobileLayout}
                    streamVisible={streamVisible}
                    canSendOnline={canSendOnline}
                    onSend={sendMessage}
                    onStopStreaming={() => void stopStreaming()}
                  />
                </>
              )}
            </div>
          </ListDetailLayout>
        </div>
        <ModalSheetPresent
          open={shareSheetOpen}
          onClose={() => {
            if (!shareBusy) setShareSheetOpen(false);
          }}
          aria-label="分享对话"
          showCloseButton
          className="p-4"
        >
          <div className="space-y-4">
            <h2 className="text-base font-medium">{"分享"}</h2>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">{"链接有效期（默认 1 小时）"}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="链接有效期">
                {SHARE_TTL_OPTIONS.map((opt) => (
                  <Toggle
                    key={opt.value}
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5"
                    isSelected={shareTtl === opt.value}
                    onChange={(selected) => {
                      if (selected) setShareTtl(opt.value);
                    }}
                  >
                    {opt.label}
                  </Toggle>
                ))}
              </div>
            </div>
            {shareResultUrl ? (
              <div className="space-y-2">
                <p className="text-muted-foreground break-all text-xs">{shareResultUrl}</p>
                <Button
                  type="button"
                  size="sm"
                  onPress={() => {
                    void copyText(shareResultUrl).then((ok) => {
                      toast(ok ? "已复制" : "复制失败", { duration: 2000 });
                    });
                  }}
                >
                  {"复制链接"}
                </Button>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                isDisabled={!currentId || shareBusy}
                onPress={() => void handleShareEntireConversation()}
              >
                {shareBusy ? "生成中…" : "分享整个对话"}
              </Button>
              <Button
                type="button"
                variant="outline"
                isDisabled={!currentId || shareBusy}
                onPress={() => {
                  setShareSheetOpen(false);
                  setSelectedPosSet(new Set());
                  setSelectionShareTtl(shareTtl);
                  setSelectionMode(true);
                }}
              >
                {"选择消息后分享"}
              </Button>
            </div>
          </div>
        </ModalSheetPresent>
        <LlmDebugPanel
          open={debugViewerOpen}
          onClose={() => setDebugViewerOpen(false)}
          snapshots={llmDebugSnapshots}
          loading={llmDebugLoading}
        />
      </div>

      {convSheetOpen && conversationMenuItems.length > 0 ? (
        <ActionSheet
          title={contextConversation ? conversationLabel(contextConversation) : undefined}
          items={conversationMenuItems}
          onClose={closeConversationMenu}
        />
      ) : null}

      <ConfirmDialog
        open={showDeleteDialog}
        title={"删除"}
        description={"永久删除此对话及全部消息？此操作不可撤销。"}
        confirmLabel={"删除"}
        variant="error"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setShowDeleteDialog(false)}
      />

      <Dialog
        isOpen={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        showCloseButton={false}
        className="max-w-sm"
      >
        <DialogHeader>
          <DialogTitle>{"修改标题"}</DialogTitle>
        </DialogHeader>
        <Input
          ref={renameInputRef}
          value={renameText}
          onChange={(e) => setRenameText(e.target.value)}
          type="text"
          className="text-sm"
          placeholder={"输入新标题"}
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
            {"取消"}
          </Button>
          <Button type="button" size="sm" onClick={() => void confirmRename()}>
            {"确定"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
