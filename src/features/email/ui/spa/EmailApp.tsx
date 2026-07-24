import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { Alert, AlertDescription, Button, Input, Spinner } from "@freeanima/ui-kit";
import {
  ActionSheet,
  ConfirmDialog,
  ContextMenu,
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
  SubjectScopeToggle,
} from "@freeanima/client/portal-sdk/react.tsx";
import { readModuleSelection, writeModuleSelection } from "@freeanima/client/portal-sdk";
import { copyText } from "@freeanima/ui-kit/lib/copy-text.ts";
import { m } from "@paraglide/messages";
import { MoreHorizontal } from "lucide-react";

import { EmailAccountFormDialog } from "./components/EmailAccountFormDialog.tsx";
import { EmailAccountSidebar, type EmailMailboxFolder } from "./components/EmailAccountSidebar.tsx";
import { EmailMessageDetail } from "./components/EmailMessageDetail.tsx";
import { EmailReplyDialog } from "./components/EmailReplyDialog.tsx";
import {
  deleteEmailAccount,
  deleteEmailMessage,
  fetchEmailAccounts,
  fetchEmailMessages,
  markEmailMessageRead,
  markEmailMessageUnread,
  patchEmailAccount,
  readEmailMessage,
  searchEmailMessages,
  syncEmailAccount,
  type EmailAccountRow,
  type EmailMessageRow,
} from "./lib/api.ts";

function folderDirection(folder: EmailMailboxFolder): "inbound" | "outbound" {
  return folder === "sent" ? "outbound" : "inbound";
}

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
  const [activeFolder, setActiveFolder] = useState<EmailMailboxFolder>("inbox");
  const activeFolderRef = useRef(activeFolder);
  activeFolderRef.current = activeFolder;
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
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [formState, setFormState] = useState<FormState | null>(null);
  const [replyMessage, setReplyMessage] = useState<EmailMessageRow | null>(null);
  const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<EmailAccountRow | null>(null);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<EmailMessageRow | null>(null);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  const applyUnreadLocal = useCallback((messageId: number, unread: boolean) => {
    setMessages((prev) => {
      if (!unread && listFilterRef.current === "unread") {
        return prev.filter((row) => row.id !== messageId);
      }
      return prev.map((row) => (row.id === messageId ? { ...row, unread } : row));
    });
    setDetail((prev) => (prev?.id === messageId ? { ...prev, unread } : prev));
  }, []);

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
        if (row.direction === "inbound" && row.unread && !writesDisabled) {
          try {
            await markEmailMessageRead(row.id);
            applyUnreadLocal(row.id, false);
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
    [applyUnreadLocal, layoutMode, writesDisabled],
  );

  const loadMessages = useCallback(
    async (accountId: number, opts?: { filter?: ListFilter; folder?: EmailMailboxFolder }) => {
      const folder = opts?.folder ?? activeFolderRef.current;
      const filter = folder === "sent" ? "all" : (opts?.filter ?? listFilterRef.current);
      setListLoading(true);
      setError("");
      try {
        const rows = await fetchEmailMessages({
          account_id: accountId,
          direction: folderDirection(folder),
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

  const loadAccounts = useCallback(
    async (opts?: { filter?: ListFilter; folder?: EmailMailboxFolder }) => {
      const folder = opts?.folder ?? activeFolderRef.current;
      const filter = folder === "sent" ? "all" : (opts?.filter ?? listFilterRef.current);
      setLoading(true);
      setError("");
      try {
        const rows = await fetchEmailAccounts();
        setAccounts(rows);
        if (rows.length === 0) {
          setActiveAccountId(null);
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

        setListLoading(true);
        try {
          const messageRows = await fetchEmailMessages({
            account_id: account.id,
            direction: folderDirection(folder),
            limit: 100,
            ...(filter === "unread" ? { unread: true } : {}),
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
    },
    [loadMessageDetail, useDrawer],
  );
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
    setActiveFolder("inbox");
    setMessages([]);
    setSelectedMessageId(null);
    setDetail(null);
    setDetailOpen(false);
    setSearchQuery("");
    setListFilter("unread");
    void loadAccounts({ filter: "unread", folder: "inbox" });
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

  const selectFolder = async (account: EmailAccountRow, folder: EmailMailboxFolder) => {
    setActiveAccountId(account.id);
    setActiveFolder(folder);
    setSelectedMessageId(null);
    setDetail(null);
    setDetailOpen(false);
    setSearchQuery("");
    if (folder === "sent") setListFilter("all");
    writeModuleSelection("email", { accountId: account.id, messageId: null });
    if (useDrawer) setListOpen(false);
    await loadMessages(account.id, {
      folder,
      filter: folder === "sent" ? "all" : listFilterRef.current,
    });
  };

  const changeListFilter = async (filter: ListFilter) => {
    if (activeFolder === "sent") return;
    setListFilter(filter);
    setSearchQuery("");
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
      setSyncNotice(
        synced > 0 ? m.email_sync_done_new({ count: synced }) : m.email_sync_done_none(),
      );
      if (activeAccountId === id) await loadMessages(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const onSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      if (activeAccountId != null) await loadMessages(activeAccountId);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const hits = await searchEmailMessages({
        query,
        limit: 50,
        ...(activeAccountId != null ? { account_id: activeAccountId } : {}),
      });
      const direction = folderDirection(activeFolderRef.current);
      setMessages(hits.filter((row) => row.direction === direction));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const copyMessageId = (message: EmailMessageRow) => {
    void copyText(String(message.id)).then((ok) => {
      if (!ok) setError(m.email_copy_id_failed());
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
        label: m.email_menu_sync(),
        onClick: () => void onSync(account.id),
      });
    }
    if (!writesDisabled) {
      items.push({
        label: m.email_edit_account(),
        onClick: () => setFormState({ mode: "edit", account }),
      });
      if (!account.default_sender) {
        items.push({
          label: m.email_set_default_sender(),
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
        label: account.enabled ? m.email_disable_account() : m.email_enable_account(),
        onClick: () =>
          void patchEmailAccount({ id: account.id, enabled: !account.enabled })
            .then((saved) => {
              setAccounts((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
            })
            .catch((err) => setError(err instanceof Error ? err.message : String(err))),
      });
      items.push({
        label: m.email_delete_account(),
        danger: true,
        onClick: () => setDeleteAccountTarget(account),
      });
    }
    return items;
  };

  const messageMenuItems = (message: EmailMessageRow): ActionSheetItem[] => {
    const showUnreadActions = activeFolder === "inbox" && message.direction !== "outbound";
    const items: ActionSheetItem[] = [];
    if (!writesDisabled) {
      items.push({
        label: m.email_reply(),
        onClick: () => setReplyMessage(message),
      });
    }
    items.push({
      label: m.email_copy_id(),
      onClick: () => copyMessageId(message),
    });
    if (!writesDisabled) {
      if (showUnreadActions) {
        if (message.unread) {
          items.push({
            label: m.email_mark_read(),
            onClick: () => onMarkRead(message),
          });
        } else {
          items.push({
            label: m.email_mark_unread(),
            onClick: () => onMarkUnread(message),
          });
        }
      }
      items.push({
        label: m.email_delete_message(),
        danger: true,
        onClick: () => setDeleteMessageTarget(message),
      });
    }
    return items;
  };

  const openAccountMenu = (account: EmailAccountRow) => {
    setSheetMenu({ title: accountLabel(account), items: accountMenuItems(account) });
  };

  const openMessageMenu = (message: EmailMessageRow) => {
    setSheetMenu({
      title: message.subject || m.habitat_email_no_subject(),
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
      setError(m.email_delete_failed({ detail: errDetail }));
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
    } catch (err) {
      const errDetail = err instanceof Error ? err.message : String(err);
      setError(m.email_delete_message_failed({ detail: errDetail }));
      setDeleteMessageTarget(null);
    }
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
          {m.email_select_account()}
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
              activeFolder === "inbox" && listFilter === "unread"
                ? m.email_no_unread_hint()
                : m.email_no_messages_hint()
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
              const menuItems = messageMenuItems(message);
              const row: ReactElement = (
                <div
                  className={`group hover:bg-muted/60 flex w-full items-stretch ${
                    selectedMessageId === message.id
                      ? "bg-primary/10 ring-primary/30 ring-1 ring-inset"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-3 py-3 text-left"
                    onClick={() => void openMessage(message)}
                  >
                    <div className="flex items-start gap-2">
                      {activeFolder === "inbox" ? (
                        message.unread ? (
                          <span className="bg-primary mt-1 inline-block h-2 w-2 shrink-0 rounded-full" />
                        ) : (
                          <span className="mt-1 inline-block h-2 w-2 shrink-0" />
                        )
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {message.subject || m.habitat_email_no_subject()}
                        </div>
                        <div className="text-muted-foreground truncate text-xs">
                          {activeFolder === "sent" ? message.to : message.from}
                        </div>
                        <div className="text-muted-foreground mt-1 truncate text-xs">
                          {message.preview}
                        </div>
                      </div>
                      <div className="text-muted-foreground shrink-0 text-[10px]">
                        {formatWhen(message.sent_at)}
                      </div>
                    </div>
                  </button>
                  {useActionSheet ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground flex min-h-11 min-w-11 shrink-0 items-center justify-center"
                      aria-label={m.email_message_actions()}
                      onClick={(e) => {
                        e.stopPropagation();
                        openMessageMenu(message);
                      }}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  ) : null}
                </div>
              );
              return (
                <li key={message.id}>
                  {contextMenuEnabled && !useActionSheet && menuItems.length > 0 ? (
                    <ContextMenu items={menuItems}>{row}</ContextMenu>
                  ) : (
                    row
                  )}
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
          listTitle={m.email_accounts_title()}
          middleTitle={
            activeAccount
              ? `${accountLabel(activeAccount)} · ${
                  activeFolder === "sent" ? m.email_sent_title() : m.email_inbox_title()
                }`
              : m.email_inbox_title()
          }
          detailTitle={detail?.subject || m.habitat_email_no_subject()}
          listOpen={listOpen}
          onListOpenChange={setListOpen}
          listToggleAriaLabel={m.email_open_accounts()}
          detailOpen={detailOpen}
          onDetailOpenChange={handleDetailOpenChange}
          middleActions={
            <>
              <SubjectScopeToggle />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2"
                disabled={refreshing || loading}
                aria-label={m.habitat_common_refresh()}
                onClick={() => void handleManualRefresh()}
              >
                {refreshing ? <Spinner className="size-3.5" /> : m.habitat_common_refresh()}
              </Button>
              {activeAccount ? (
                <>
                  {listLoading || searching ? <Spinner className="size-4" /> : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={syncing || writesDisabled}
                    onClick={() => void onSync()}
                  >
                    {syncing ? m.email_syncing() : m.email_sync()}
                  </Button>
                </>
              ) : null}
            </>
          }
          middleHeaderExtra={
            activeAccount ? (
              <div className="flex flex-col gap-2">
                {activeFolder === "inbox" ? (
                  <div className="inline-flex w-fit overflow-hidden rounded-md border shadow-xs">
                    <Button
                      type="button"
                      variant={listFilter === "unread" ? "default" : "outline"}
                      size="sm"
                      className="rounded-none border-0"
                      onClick={() => void changeListFilter("unread")}
                    >
                      {m.email_filter_unread()}
                    </Button>
                    <Button
                      type="button"
                      variant={listFilter === "all" ? "default" : "outline"}
                      size="sm"
                      className="rounded-none border-0 border-l"
                      onClick={() => void changeListFilter("all")}
                    >
                      {m.email_filter_all()}
                    </Button>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Input
                    className="h-8 min-w-0 flex-1"
                    placeholder={m.email_search_placeholder()}
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
                    disabled={searching}
                    onClick={() => void onSearch()}
                  >
                    {m.email_search()}
                  </Button>
                </div>
              </div>
            ) : null
          }
          list={
            <EmailAccountSidebar
              accounts={accounts}
              activeAccountId={activeAccountId}
              activeFolder={activeFolder}
              writesDisabled={writesDisabled}
              useActionSheet={useActionSheet}
              contextMenuEnabled={contextMenuEnabled}
              contextMenuItemsForAccount={accountMenuItems}
              onSelectFolder={(account, folder) => void selectFolder(account, folder)}
              onAdd={() => setFormState({ mode: "create" })}
              onEdit={(account) => setFormState({ mode: "edit", account })}
              onOpenMenu={openAccountMenu}
            />
          }
          middle={messageList}
          detail={
            <EmailMessageDetail
              loading={detailLoading}
              message={detail}
              writesDisabled={writesDisabled}
              showUnreadActions={activeFolder === "inbox"}
              {...(detail
                ? {
                    onReply: () => setReplyMessage(detail),
                    onCopyId: () => copyMessageId(detail),
                    onDelete: () => setDeleteMessageTarget(detail),
                    ...(activeFolder === "inbox"
                      ? detail.unread
                        ? { onMarkRead: () => onMarkRead(detail) }
                        : { onMarkUnread: () => onMarkUnread(detail) }
                      : {}),
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
            void selectFolder(saved, "inbox");
          }
        }}
      />

      <EmailReplyDialog
        open={replyMessage != null}
        message={replyMessage}
        accountId={replyMessage?.account_id ?? activeAccountId}
        disabled={writesDisabled}
        onClose={() => setReplyMessage(null)}
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
        title={m.email_delete_account()}
        description={m.email_delete_confirm()}
        confirmLabel={m.email_delete_account()}
        cancelLabel={m.email_cancel()}
        variant="error"
        onConfirm={() => void confirmDeleteAccount()}
        onCancel={() => setDeleteAccountTarget(null)}
      />

      <ConfirmDialog
        open={deleteMessageTarget != null}
        title={m.email_delete_message()}
        description={m.email_delete_message_confirm()}
        confirmLabel={m.email_delete_message()}
        cancelLabel={m.email_cancel()}
        variant="error"
        onConfirm={() => void confirmDeleteMessage()}
        onCancel={() => setDeleteMessageTarget(null)}
      />
    </div>
  );
}
