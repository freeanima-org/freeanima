import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, Button, Checkbox, Input, Spinner } from "@freeanima/ui-kit";
import {
  ActionSheet,
  ConfirmDialog,
  EmptyState,
  PullToRefresh,
  StatusAlert,
} from "@freeanima/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/ui-kit/composite";
import {
  ThreeColumnLayout,
  useDrawerNav,
  useThreeColumnLayoutMode,
} from "@freeanima/ui-kit/layout";
import {
  useActionSheetCapability,
  useContextMenuCapability,
  useHabitatConnection,
  useNetworkOnline,
  useSubjectScope,
} from "@freeanima/client/portal-sdk/react.tsx";
import { readModuleSelection, writeModuleSelection } from "@freeanima/client/portal-sdk";
import { usePortalRead } from "@freeanima/client/portal-sdk/portal-query";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";

import { EmailAccountFormDialog } from "./components/EmailAccountFormDialog.tsx";
import { AttachTaskDialog } from "./components/AttachTaskDialog.tsx";
import { EmailAccountSidebar, isSystemMailbox } from "./components/EmailAccountSidebar.tsx";
import { EmailMessageDetail } from "./components/EmailMessageDetail.tsx";
import { EmailMessageRowView } from "./components/EmailMessageRowView.tsx";
import { EmailReplyDialog } from "./components/EmailReplyDialog.tsx";
import {
  createEmailMailbox,
  deleteEmailAccount,
  deleteEmailMailbox,
  deleteEmailMessage,
  fetchEmailAccounts,
  fetchEmailMailboxes,
  fetchEmailMessages,
  attachTaskToEmail,
  detachTaskFromEmail,
  emailHasAttachedTask,
  markEmailMessageFlagged,
  markEmailMessageRead,
  markEmailMessageUnflagged,
  markEmailMessageUnread,
  moveEmailMessage,
  patchEmailAccount,
  readEmailMessage,
  renameEmailMailbox,
  searchEmailMessages,
  syncEmailAccount,
  type EmailAccountRow,
  type EmailMailboxInfo,
  type EmailMessageRow,
} from "./lib/api.ts";
import { openEntityResource } from "@freeanima/client/portal-sdk/open-entity-resource.ts";

function accountLabel(account: EmailAccountRow): string {
  return account.display_name || account.address;
}

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type ListFilter = "unread" | "all";
type SheetMenuState = { title?: string; items: ActionSheetItem[] };
type FormState = { mode: "create" | "edit"; account?: EmailAccountRow | null };

export function EmailApp() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const writesDisabled = !networkOnline || habitatConnection !== "connected";
  const layoutMode = useThreeColumnLayoutMode();
  const useDrawer = useDrawerNav();
  const contextMenuEnabled = useContextMenuCapability();
  const useActionSheet = useActionSheetCapability();

  const [accounts, setAccounts] = useState<EmailAccountRow[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [mailboxes, setMailboxes] = useState<EmailMailboxInfo[]>([]);
  const [activeMailbox, setActiveMailbox] = useState<string | null>(null);
  const activeMailboxRef = useRef(activeMailbox);
  activeMailboxRef.current = activeMailbox;
  const [messages, setMessages] = useState<EmailMessageRow[]>([]);
  const [listFilter, setListFilter] = useState<ListFilter>("unread");
  const listFilterRef = useRef(listFilter);
  listFilterRef.current = listFilter;
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EmailMessageRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [filterAttachment, setFilterAttachment] = useState(false);
  const [searchAllFolders, setSearchAllFolders] = useState(false);
  const [searching, setSearching] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [error, setError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [formState, setFormState] = useState<FormState | null>(null);
  const [replyMessage, setReplyMessage] = useState<EmailMessageRow | null>(null);
  const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<EmailAccountRow | null>(null);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<EmailMessageRow | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<{
    account: EmailAccountRow;
    mailbox: EmailMailboxInfo;
  } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [deleteBatchPending, setDeleteBatchPending] = useState(false);
  const [attachTaskTarget, setAttachTaskTarget] = useState<EmailMessageRow | null>(null);
  const [messageHasTask, setMessageHasTask] = useState<Record<number, boolean>>({});

  const accountsQuery = usePortalRead({
    queryKey: ["email", "accounts", subjectKind],
    queryFn: () => fetchEmailAccounts(),
  });

  useEffect(() => {
    if (accountsQuery.data) setAccounts(accountsQuery.data);
  }, [accountsQuery.data]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const allVisibleSelected =
    messages.length > 0 && messages.every((row) => selectedIds.has(row.id));
  const someVisibleSelected = messages.some((row) => selectedIds.has(row.id));

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectId = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = messages.length > 0 && messages.every((row) => prev.has(row.id));
      if (allSelected) return new Set();
      return new Set(messages.map((row) => row.id));
    });
  }, [messages]);

  const applyUnreadLocal = useCallback((messageId: number, unread: boolean) => {
    setMessages((prev) => {
      if (!unread && listFilterRef.current === "unread") {
        return prev.filter((row) => row.id !== messageId);
      }
      return prev.map((row) => (row.id === messageId ? { ...row, unread } : row));
    });
    if (!unread && listFilterRef.current === "unread") {
      setSelectedIds((prev) => {
        if (!prev.has(messageId)) return prev;
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
    setDetail((prev) => (prev?.id === messageId ? { ...prev, unread } : prev));
  }, []);

  const applyFlaggedLocal = useCallback((messageId: number, flagged: boolean) => {
    setMessages((prev) => prev.map((row) => (row.id === messageId ? { ...row, flagged } : row)));
    setDetail((prev) => (prev?.id === messageId ? { ...prev, flagged } : prev));
  }, []);

  const removeMessagesLocal = useCallback((ids: ReadonlySet<number>) => {
    setMessages((prev) => prev.filter((row) => !ids.has(row.id)));
    setSelectedMessageId((prev) => (prev != null && ids.has(prev) ? null : prev));
    setDetail((prev) => (prev != null && ids.has(prev.id) ? null : prev));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const runBatch = useCallback(
    async (ids: number[], action: (id: number) => Promise<void>): Promise<number[]> => {
      if (ids.length === 0 || batchBusy) return [];
      setBatchBusy(true);
      setError("");
      const ok: number[] = [];
      const failures: string[] = [];
      for (const id of ids) {
        try {
          await action(id);
          ok.push(id);
        } catch (err) {
          failures.push(`#${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      setBatchBusy(false);
      if (failures.length > 0) {
        setError(
          `批量操作完成，${String(failures.length)} 项失败：${failures.slice(0, 3).join("; ")}`,
        );
      }
      return ok;
    },
    [batchBusy],
  );

  const loadMessageDetail = useCallback(
    async (message: EmailMessageRow, accountId: number) => {
      setSelectedMessageId(message.id);
      setDetailLoading(true);
      setError("");
      if (layoutMode === "compact") setDetailOpen(true);
      writeModuleSelection("email", { accountId, messageId: message.id });
      try {
        // raw=true：返回解码后的正文 content（html 或 plain），供沙箱 / 原文展示
        const row = await readEmailMessage(message.id, { raw: true });
        setDetail(row);
        void emailHasAttachedTask(row.id).then((has) => {
          setMessageHasTask((prev) => ({ ...prev, [row.id]: has }));
        });
        if (row.direction === "inbound" && row.unread && !writesDisabled) {
          try {
            await markEmailMessageRead(row.id);
            // 未读 tab：不立刻从列表剔除，等切 tab / 手动刷新 / 同步再 loadMessages
            setDetail((prev) => (prev?.id === row.id ? { ...prev, unread: false } : prev));
          } catch (markErr) {
            console.warn("markEmailMessageRead failed:", markErr);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setDetailLoading(false);
      }
    },
    [layoutMode, writesDisabled],
  );

  const loadMailboxes = useCallback(async (accountId: number) => {
    try {
      const boxes = await fetchEmailMailboxes(accountId);
      setMailboxes(boxes);
      return boxes;
    } catch {
      setMailboxes([]);
      return [] as EmailMailboxInfo[];
    }
  }, []);

  const loadMessages = useCallback(
    async (accountId: number, opts?: { filter?: ListFilter; mailbox?: string }) => {
      const mailbox = opts?.mailbox ?? activeMailboxRef.current ?? "INBOX";
      const filter = opts?.filter ?? listFilterRef.current;
      setListLoading(true);
      setError("");
      try {
        const rows = await fetchEmailMessages({
          account_id: accountId,
          mailbox,
          limit: 100,
          ...(filter === "unread" ? { unread: true } : {}),
        });
        setMessages(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setMessages([]);
      } finally {
        setListLoading(false);
      }
    },
    [],
  );

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchEmailAccounts();
      accountsQuery.setData(rows);
      setAccounts(rows);
      if (rows.length === 0) {
        setActiveAccountId(null);
        setMailboxes([]);
        setActiveMailbox(null);
        setMessages([]);
        return;
      }

      const stored = readModuleSelection("email");
      const enabled = rows.filter((a) => a.enabled);
      const fallback = enabled[0] ?? rows[0];
      const account = rows.find((a) => a.id === stored?.accountId) ?? fallback;
      if (!account) return;

      setActiveAccountId(account.id);
      if (useDrawer) setListOpen(false);

      const boxes = await loadMailboxes(account.id);
      const inbox =
        boxes.find((b) => b.path.toUpperCase() === "INBOX")?.path ?? boxes[0]?.path ?? "INBOX";
      setActiveMailbox(inbox);
      setListFilter("unread");

      setListLoading(true);
      try {
        const messageRows = await fetchEmailMessages({
          account_id: account.id,
          mailbox: inbox,
          limit: 100,
          unread: true,
        });
        setMessages(messageRows);

        const storedMessage =
          stored?.messageId != null
            ? messageRows.find((row) => row.id === stored.messageId)
            : undefined;

        if (storedMessage) {
          await loadMessageDetail(storedMessage, account.id);
        } else {
          writeModuleSelection("email", { accountId: account.id, messageId: null });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setMessages([]);
      } finally {
        setListLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [accountsQuery, loadMailboxes, loadMessageDetail, useDrawer]);
  const handleManualRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const rows = await fetchEmailAccounts();
      setAccounts(rows);
      if (activeAccountId != null) {
        await loadMessages(activeAccountId);
      } else {
        await loadAccounts();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [activeAccountId, loadAccounts, loadMessages, refreshing]);

  const resetForSubjectKind = useEffectEvent(() => {
    setActiveAccountId(null);
    setActiveMailbox(null);
    setMailboxes([]);
    setMessages([]);
    setSelectedMessageId(null);
    setDetail(null);
    setDetailOpen(false);
    setSearchQuery("");
    setListFilter("unread");
    void loadAccounts();
  });

  useEffect(() => {
    resetForSubjectKind();
  }, [subjectKind]);

  useEffect(() => {
    if (layoutMode !== "compact") {
      setDetailOpen(false);
    } else if (detail) {
      setDetailOpen(true);
    }
  }, [layoutMode, detail?.id]);

  const selectMailbox = async (account: EmailAccountRow, mailbox: string) => {
    setActiveAccountId(account.id);
    if (account.id !== activeAccountId || mailboxes.length === 0) {
      await loadMailboxes(account.id);
    }
    setActiveMailbox(mailbox);
    setSelectedMessageId(null);
    setDetail(null);
    setDetailOpen(false);
    setSearchQuery("");
    exitSelectionMode();
    const lower = mailbox.toLowerCase();
    const isInbox = lower === "inbox" || lower.endsWith("/inbox");
    if (!isInbox) setListFilter("all");
    writeModuleSelection("email", { accountId: account.id, messageId: null });
    if (useDrawer) setListOpen(false);
    await loadMessages(account.id, {
      mailbox,
      filter: isInbox ? listFilterRef.current : "all",
    });
  };

  const changeListFilter = async (filter: ListFilter) => {
    setListFilter(filter);
    setSearchQuery("");
    clearSelection();
    if (activeAccountId != null) await loadMessages(activeAccountId, { filter });
  };

  const openMessage = async (message: EmailMessageRow) => {
    if (activeAccountId == null) return;
    await loadMessageDetail(message, activeAccountId);
  };

  const handleDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setSelectedMessageId(null);
      setDetail(null);
      if (activeAccountId != null) {
        writeModuleSelection("email", { accountId: activeAccountId, messageId: null });
      }
    }
  };

  const onSync = async (accountId?: number) => {
    const id = accountId ?? activeAccountId;
    if (id == null) return;
    setSyncing(true);
    setError("");
    setSyncNotice("");
    try {
      const results = await syncEmailAccount(id, 100);
      const synced = results.reduce((sum, row) => sum + row.upserted_messages, 0);
      setSyncNotice(synced > 0 ? `同步完成，新增 ${synced} 封邮件。` : "同步完成，暂无新邮件。");
      await loadMailboxes(id);
      if (activeAccountId === id) await loadMessages(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const onSearch = async () => {
    const query = searchQuery.trim();
    const hasFilters =
      filterFrom.trim() ||
      filterTo.trim() ||
      filterSubject.trim() ||
      filterFlagged ||
      filterAttachment;
    if (!query && !hasFilters) {
      if (activeAccountId != null) await loadMessages(activeAccountId);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const hits = await searchEmailMessages({
        limit: 50,
        ...(query ? { query } : {}),
        ...(activeAccountId != null ? { account_id: activeAccountId } : {}),
        ...(!searchAllFolders && activeMailbox ? { mailbox: activeMailbox } : {}),
        ...(filterFrom.trim() ? { from: filterFrom.trim() } : {}),
        ...(filterTo.trim() ? { to: filterTo.trim() } : {}),
        ...(filterSubject.trim() ? { subject: filterSubject.trim() } : {}),
        ...(filterFlagged ? { flagged: true } : {}),
        ...(filterAttachment ? { has_attachment: true } : {}),
      });
      setMessages(hits);
      clearSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const clearSearchFilters = () => {
    setFilterFrom("");
    setFilterTo("");
    setFilterSubject("");
    setFilterFlagged(false);
    setFilterAttachment(false);
    setSearchAllFolders(false);
  };

  const copyMessageId = (message: EmailMessageRow) => {
    void copyText(String(message.id)).then((ok) => {
      if (!ok) setError("复制 ID 失败");
    });
  };

  const onMarkRead = (message: EmailMessageRow) => {
    void markEmailMessageRead(message.id)
      .then(() => applyUnreadLocal(message.id, false))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  const onMarkUnread = (message: EmailMessageRow) => {
    void markEmailMessageUnread(message.id)
      .then(() => applyUnreadLocal(message.id, true))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  };

  const accountMenuItems = (account: EmailAccountRow): ActionSheetItem[] => {
    const items: ActionSheetItem[] = [];
    if (!writesDisabled && !syncing) {
      items.push({
        label: "同步收件箱",
        onClick: () => void onSync(account.id),
      });
    }
    if (!writesDisabled) {
      items.push({
        label: "编辑账户",
        onClick: () => setFormState({ mode: "edit", account }),
      });
      if (!account.default_sender) {
        items.push({
          label: "设为默认发件账户",
          onClick: () =>
            void patchEmailAccount({ id: account.id, default_sender: true })
              .then((saved) => {
                setAccounts((prev) =>
                  prev.map((row) =>
                    row.id === saved.id ? saved : { ...row, default_sender: false },
                  ),
                );
              })
              .catch((err) => setError(err instanceof Error ? err.message : String(err))),
        });
      }
      items.push({
        label: account.enabled ? "禁用" : "启用",
        onClick: () =>
          void patchEmailAccount({ id: account.id, enabled: !account.enabled })
            .then((saved) => {
              setAccounts((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
            })
            .catch((err) => setError(err instanceof Error ? err.message : String(err))),
      });
      items.push({
        label: "删除账户",
        danger: true,
        onClick: () => setDeleteAccountTarget(account),
      });
    }
    return items;
  };

  const messageMenuItems = (message: EmailMessageRow): ActionSheetItem[] => {
    const items: ActionSheetItem[] = [];
    if (!writesDisabled) {
      items.push({
        label: "回复",
        onClick: () => setReplyMessage(message),
      });
    }
    items.push({
      label: "复制 ID",
      onClick: () => copyMessageId(message),
    });
    if (!writesDisabled) {
      if (messageHasTask[message.id]) {
        items.push({
          label: "查看任务",
          onClick: () =>
            void openEntityResource({
              id: message.id,
              component: "task_item",
              present: "overlay",
            }),
        });
        items.push({
          label: "移除任务",
          onClick: () =>
            void detachTaskFromEmail(message.id)
              .then(() => setMessageHasTask((prev) => ({ ...prev, [message.id]: false })))
              .catch((err) => setError(err instanceof Error ? err.message : String(err))),
        });
      } else {
        items.push({
          label: "添加任务…",
          onClick: () => setAttachTaskTarget(message),
        });
      }
      if (message.unread) {
        items.push({ label: "标记为已读", onClick: () => onMarkRead(message) });
      } else {
        items.push({ label: "设为未读", onClick: () => onMarkUnread(message) });
      }
      items.push({
        label: message.flagged ? "取消星标" : "加星标",
        onClick: () =>
          void (
            message.flagged
              ? markEmailMessageUnflagged(message.id)
              : markEmailMessageFlagged(message.id)
          )
            .then(() => {
              setMessages((prev) =>
                prev.map((row) =>
                  row.id === message.id ? { ...row, flagged: !message.flagged } : row,
                ),
              );
              setDetail((prev) =>
                prev?.id === message.id ? { ...prev, flagged: !message.flagged } : prev,
              );
            })
            .catch((err) => setError(err instanceof Error ? err.message : String(err))),
      });
      for (const box of mailboxes) {
        if (box.path === activeMailbox) continue;
        items.push({
          label: `移动到… ${box.name || box.path}`,
          onClick: () =>
            void moveEmailMessage(message.id, box.path)
              .then(() => {
                setMessages((prev) => prev.filter((row) => row.id !== message.id));
                if (selectedMessageId === message.id) {
                  setSelectedMessageId(null);
                  setDetail(null);
                }
              })
              .catch((err) => setError(err instanceof Error ? err.message : String(err))),
        });
      }
      items.push({
        label: "删除邮件",
        danger: true,
        onClick: () => setDeleteMessageTarget(message),
      });
    }
    return items;
  };

  const folderMenuItems = (
    account: EmailAccountRow,
    mailbox: EmailMailboxInfo,
  ): ActionSheetItem[] => {
    if (writesDisabled || isSystemMailbox(mailbox)) return [];
    return [
      {
        label: "重命名文件夹",
        onClick: () => {
          const next = window.prompt("文件夹名称", mailbox.path);
          if (!next?.trim() || next.trim() === mailbox.path) return;
          void renameEmailMailbox(account.id, mailbox.path, next.trim())
            .then((boxes) => {
              setMailboxes(boxes);
              if (activeMailbox === mailbox.path) setActiveMailbox(next.trim());
            })
            .catch((err) => setError(err instanceof Error ? err.message : String(err)));
        },
      },
      {
        label: "删除文件夹",
        danger: true,
        onClick: () => setDeleteFolderTarget({ account, mailbox }),
      },
    ];
  };

  const openAccountMenu = (account: EmailAccountRow) => {
    setSheetMenu({ title: accountLabel(account), items: accountMenuItems(account) });
  };

  const openMessageMenu = (message: EmailMessageRow) => {
    setSheetMenu({
      title: message.subject || "(无主题)",
      items: messageMenuItems(message),
    });
  };

  const confirmDeleteAccount = async () => {
    if (!deleteAccountTarget) return;
    const id = deleteAccountTarget.id;
    try {
      await deleteEmailAccount(id);
      setDeleteAccountTarget(null);
      setAccounts((prev) => prev.filter((row) => row.id !== id));
      if (activeAccountId === id) {
        setActiveAccountId(null);
        setMessages([]);
        setDetail(null);
      }
    } catch (err) {
      const errDetail = err instanceof Error ? err.message : String(err);
      setError(`删除账户失败：${errDetail}`);
      setDeleteAccountTarget(null);
    }
  };

  const confirmDeleteMessage = async () => {
    if (!deleteMessageTarget) return;
    const id = deleteMessageTarget.id;
    try {
      await deleteEmailMessage(id);
      setDeleteMessageTarget(null);
      setMessages((prev) => prev.filter((row) => row.id !== id));
      if (selectedMessageId === id) {
        setSelectedMessageId(null);
        setDetail(null);
        setDetailOpen(false);
      }
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      const errDetail = err instanceof Error ? err.message : String(err);
      setError(`删除邮件失败：${errDetail}`);
      setDeleteMessageTarget(null);
    }
  };

  const onBatchMarkRead = () =>
    void runBatch(selectedIdList, async (id) => {
      await markEmailMessageRead(id);
      applyUnreadLocal(id, false);
    });

  const onBatchMarkUnread = () =>
    void runBatch(selectedIdList, async (id) => {
      await markEmailMessageUnread(id);
      applyUnreadLocal(id, true);
    });

  const onBatchStar = (flagged: boolean) =>
    void runBatch(selectedIdList, async (id) => {
      if (flagged) await markEmailMessageFlagged(id);
      else await markEmailMessageUnflagged(id);
      applyFlaggedLocal(id, flagged);
    });

  const onBatchMove = (mailboxPath: string) => {
    const ids = selectedIdList;
    void runBatch(ids, async (id) => {
      await moveEmailMessage(id, mailboxPath);
    }).then((ok) => {
      if (ok.length > 0) removeMessagesLocal(new Set(ok));
    });
  };

  const openBatchMoveMenu = () => {
    const items: ActionSheetItem[] = mailboxes
      .filter((box) => box.path !== activeMailbox)
      .map((box) => ({
        label: box.name || box.path,
        onClick: () => onBatchMove(box.path),
      }));
    if (items.length === 0) return;
    setSheetMenu({ title: "移动到…", items });
  };

  const confirmDeleteBatch = async () => {
    const ids = selectedIdList;
    setDeleteBatchPending(false);
    const ok = await runBatch(ids, async (id) => {
      await deleteEmailMessage(id);
    });
    if (ok.length > 0) removeMessagesLocal(new Set(ok));
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  const messageList = (
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? (
        <Alert variant="error" className="m-2 shrink-0">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      ) : null}
      {syncNotice ? (
        <Alert variant="success" className="m-2 shrink-0">
          <AlertDescription className="text-sm">{syncNotice}</AlertDescription>
        </Alert>
      ) : null}
      {!activeAccount ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-sm">
          {"选择邮箱账户查看收件箱"}
        </div>
      ) : listLoading && messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <Spinner className="size-4" />
        </div>
      ) : messages.length === 0 ? (
        <PullToRefresh
          className="min-h-0 flex-1"
          disabled={refreshing || listLoading}
          onRefresh={handleManualRefresh}
        >
          <EmptyState
            message={
              listFilter === "unread"
                ? "暂无未读邮件。可切换到「全部」，或点击同步。"
                : "暂无邮件。点击「同步」从 IMAP 拉取。"
            }
            className="items-start flex-1 p-4 text-left"
          />
        </PullToRefresh>
      ) : (
        <PullToRefresh
          className="min-h-0 flex-1"
          disabled={refreshing || listLoading}
          onRefresh={handleManualRefresh}
        >
          <ul className="divide-border divide-y">
            {messages.map((message) => {
              const isChecked = selectedIds.has(message.id);
              return (
                <li key={message.id}>
                  <EmailMessageRowView
                    message={message}
                    active={selectedMessageId === message.id}
                    selected={isChecked}
                    selectionMode={selectionMode}
                    batchBusy={batchBusy}
                    useActionSheet={useActionSheet}
                    contextMenuEnabled={contextMenuEnabled}
                    contextMenuItems={messageMenuItems(message)}
                    formatWhen={formatWhen}
                    onOpen={() => void openMessage(message)}
                    onToggleSelect={() => toggleSelectId(message.id)}
                    onOpenMenu={() => openMessageMenu(message)}
                  />
                </li>
              );
            })}
          </ul>
        </PullToRefresh>
      )}
    </div>
  );

  return (
    <div className="h-full min-h-0">
      {error && accounts.length === 0 ? (
        <div className="p-4">
          <StatusAlert variant="error">{error}</StatusAlert>
        </div>
      ) : (
        <ThreeColumnLayout
          layoutMode={layoutMode}
          columnSplitKey="email"
          listTitle={"邮箱"}
          middleTitle={
            activeAccount
              ? `${accountLabel(activeAccount)} · ${activeMailbox ?? "收件箱"}`
              : "收件箱"
          }
          detailTitle={detail?.subject || "(无主题)"}
          listOpen={listOpen}
          onListOpenChange={setListOpen}
          listToggleAriaLabel={"打开账户列表"}
          detailOpen={detailOpen}
          onDetailOpenChange={handleDetailOpenChange}
          middleHeaderExtra={
            activeAccount ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex w-fit overflow-hidden rounded-md border shadow-xs">
                    <Button
                      type="button"
                      variant={listFilter === "unread" ? "default" : "outline"}
                      size="sm"
                      className="rounded-none border-0"
                      onClick={() => void changeListFilter("unread")}
                    >
                      {"未读"}
                    </Button>
                    <Button
                      type="button"
                      variant={listFilter === "all" ? "default" : "outline"}
                      size="sm"
                      className="rounded-none border-0 border-l"
                      onClick={() => void changeListFilter("all")}
                    >
                      {"全部"}
                    </Button>
                  </div>
                  <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                    {listLoading || searching || batchBusy ? <Spinner className="size-4" /> : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={selectionMode ? "secondary" : "outline"}
                      isDisabled={messages.length === 0 && !selectionMode}
                      onClick={() => {
                        if (selectionMode) exitSelectionMode();
                        else setSelectionMode(true);
                      }}
                    >
                      {selectionMode ? "取消" : "选择"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      isDisabled={writesDisabled}
                      onClick={() => setComposeOpen(true)}
                    >
                      {"写邮件"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      isDisabled={syncing || writesDisabled}
                      onClick={() => void onSync()}
                    >
                      {syncing ? "同步中…" : "同步"}
                    </Button>
                  </div>
                </div>
                {selectionMode ? (
                  <div className="bg-muted/40 flex flex-col gap-2 rounded-md border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Checkbox
                        isSelected={allVisibleSelected}
                        isIndeterminate={someVisibleSelected && !allVisibleSelected}
                        isDisabled={messages.length === 0 || batchBusy}
                        onChange={() => toggleSelectAllVisible()}
                        aria-label={"全选"}
                      />
                      <span className="text-muted-foreground text-xs">
                        {`已选 ${String(selectedIds.size)} 封`}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        isDisabled={selectedIds.size === 0 || batchBusy}
                        onClick={() => clearSelection()}
                      >
                        {"清除选择"}
                      </Button>
                    </div>
                    {!writesDisabled && selectedIds.size > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7"
                          isDisabled={batchBusy}
                          onClick={onBatchMarkRead}
                        >
                          {"标记为已读"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7"
                          isDisabled={batchBusy}
                          onClick={onBatchMarkUnread}
                        >
                          {"设为未读"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7"
                          isDisabled={batchBusy}
                          onClick={() => onBatchStar(true)}
                        >
                          {"加星标"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7"
                          isDisabled={batchBusy}
                          onClick={() => onBatchStar(false)}
                        >
                          {"取消星标"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7"
                          isDisabled={batchBusy || mailboxes.every((b) => b.path === activeMailbox)}
                          onClick={openBatchMoveMenu}
                        >
                          {"移动到…"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7"
                          isDisabled={batchBusy}
                          onClick={() => setDeleteBatchPending(true)}
                        >
                          {"删除邮件"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Input
                    className="h-8 min-w-0 flex-1"
                    placeholder={"搜索邮件"}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void onSearch();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchFiltersOpen((v) => !v)}
                  >
                    {"筛选"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isDisabled={searching}
                    onClick={() => void onSearch()}
                  >
                    {"搜索邮件"}
                  </Button>
                </div>
                <p className="text-muted-foreground text-[11px]">{"仅搜索已同步的邮件。"}</p>
                {searchFiltersOpen ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      className="h-8"
                      placeholder={"发件人"}
                      value={filterFrom}
                      onChange={(e) => setFilterFrom(e.target.value)}
                    />
                    <Input
                      className="h-8"
                      placeholder={"收件人"}
                      value={filterTo}
                      onChange={(e) => setFilterTo(e.target.value)}
                    />
                    <Input
                      className="h-8 sm:col-span-2"
                      placeholder={"主题"}
                      value={filterSubject}
                      onChange={(e) => setFilterSubject(e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={filterFlagged}
                        onChange={(e) => setFilterFlagged(e.target.checked)}
                      />
                      {"已加星标"}
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={filterAttachment}
                        onChange={(e) => setFilterAttachment(e.target.checked)}
                      />
                      {"有附件"}
                    </label>
                    <label className="flex items-center gap-2 text-xs sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={searchAllFolders}
                        onChange={(e) => setSearchAllFolders(e.target.checked)}
                      />
                      {"全部文件夹"}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="sm:col-span-2"
                      onClick={clearSearchFilters}
                    >
                      {"清除筛选"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null
          }
          list={
            <EmailAccountSidebar
              accounts={accounts}
              activeAccountId={activeAccountId}
              mailboxes={mailboxes}
              activeMailbox={activeMailbox}
              writesDisabled={writesDisabled}
              useActionSheet={useActionSheet}
              contextMenuEnabled={contextMenuEnabled}
              contextMenuItemsForAccount={accountMenuItems}
              folderMenuItems={folderMenuItems}
              onSelectMailbox={(account, mailbox) => void selectMailbox(account, mailbox)}
              onAddAccount={() => setFormState({ mode: "create" })}
              onEditAccount={(account) => setFormState({ mode: "edit", account })}
              onOpenAccountMenu={openAccountMenu}
              onNewFolder={(account) => {
                const path = window.prompt("文件夹名称");
                if (!path?.trim()) return;
                void createEmailMailbox(account.id, path.trim())
                  .then(setMailboxes)
                  .catch((err) => setError(err instanceof Error ? err.message : String(err)));
              }}
              onOpenFolderMenu={(account, mailbox) =>
                setSheetMenu({
                  title: mailbox.path,
                  items: folderMenuItems(account, mailbox),
                })
              }
            />
          }
          middle={messageList}
          detail={
            <EmailMessageDetail
              loading={detailLoading}
              message={detail}
              writesDisabled={writesDisabled}
              showUnreadActions
              {...(detail
                ? {
                    onReply: () => setReplyMessage(detail),
                    onCopyId: () => copyMessageId(detail),
                    onDelete: () => setDeleteMessageTarget(detail),
                    ...(detail.unread
                      ? { onMarkRead: () => onMarkRead(detail) }
                      : { onMarkUnread: () => onMarkUnread(detail) }),
                  }
                : {})}
            />
          }
        />
      )}

      <EmailAccountFormDialog
        open={formState != null}
        mode={formState?.mode ?? "create"}
        account={formState?.account ?? null}
        disabled={writesDisabled}
        onClose={() => setFormState(null)}
        onSaved={(saved) => {
          setAccounts((prev) => {
            const exists = prev.some((row) => row.id === saved.id);
            if (!exists) return [...prev, saved];
            return prev.map((row) => {
              if (row.id === saved.id) return saved;
              if (saved.default_sender) return { ...row, default_sender: false };
              return row;
            });
          });
          if (formState?.mode === "create") {
            void selectMailbox(saved, "INBOX");
          }
        }}
      />

      <AttachTaskDialog
        open={attachTaskTarget != null}
        subject={attachTaskTarget?.subject ?? ""}
        onClose={() => setAttachTaskTarget(null)}
        onSubmit={async (input) => {
          if (!attachTaskTarget) return;
          await attachTaskToEmail(attachTaskTarget.id, input);
          setMessageHasTask((prev) => ({ ...prev, [attachTaskTarget.id]: true }));
        }}
      />

      <EmailReplyDialog
        open={replyMessage != null || composeOpen}
        message={composeOpen ? null : replyMessage}
        accountId={replyMessage?.account_id ?? activeAccountId}
        disabled={writesDisabled}
        onClose={() => {
          setReplyMessage(null);
          setComposeOpen(false);
        }}
      />

      {sheetMenu ? (
        <ActionSheet
          title={sheetMenu.title}
          items={sheetMenu.items}
          onClose={() => setSheetMenu(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteAccountTarget != null}
        title={"删除账户"}
        description={
          "确定删除此邮件账户？本地已同步的邮件与线程也会一并清除，不会删除服务器上的邮件。"
        }
        confirmLabel={"删除账户"}
        cancelLabel={"取消"}
        variant="error"
        onConfirm={() => void confirmDeleteAccount()}
        onCancel={() => setDeleteAccountTarget(null)}
      />

      <ConfirmDialog
        open={deleteMessageTarget != null}
        title={"删除邮件"}
        description={"确定删除此邮件？将删除本地记录，并在可能时同步删除 IMAP。"}
        confirmLabel={"删除邮件"}
        cancelLabel={"取消"}
        variant="error"
        onConfirm={() => void confirmDeleteMessage()}
        onCancel={() => setDeleteMessageTarget(null)}
      />

      <ConfirmDialog
        open={deleteBatchPending}
        title={"删除邮件"}
        description={`确定删除所选的 ${String(selectedIds.size)} 封邮件？将删除本地记录，并在可能时同步删除 IMAP。`}
        confirmLabel={"删除邮件"}
        cancelLabel={"取消"}
        variant="error"
        onConfirm={() => void confirmDeleteBatch()}
        onCancel={() => setDeleteBatchPending(false)}
      />

      <ConfirmDialog
        open={deleteFolderTarget != null}
        title={"删除文件夹"}
        description={`在邮件服务器上删除文件夹 ${deleteFolderTarget?.mailbox.path ?? ""}？`}
        confirmLabel={"删除文件夹"}
        cancelLabel={"取消"}
        variant="error"
        onConfirm={() => {
          if (!deleteFolderTarget) return;
          const { account, mailbox } = deleteFolderTarget;
          void deleteEmailMailbox(account.id, mailbox.path)
            .then((boxes) => {
              setMailboxes(boxes);
              if (activeMailbox === mailbox.path) {
                const inbox =
                  boxes.find((b) => b.path.toUpperCase() === "INBOX")?.path ??
                  boxes[0]?.path ??
                  "INBOX";
                void selectMailbox(account, inbox);
              }
              setDeleteFolderTarget(null);
            })
            .catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
              setDeleteFolderTarget(null);
            });
        }}
        onCancel={() => setDeleteFolderTarget(null)}
      />
    </div>
  );
}
