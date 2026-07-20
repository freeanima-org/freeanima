import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Alert, AlertDescription, Button, Input, Spinner } from "@freeanima/frontend/ui-kit";
import {
  ActionSheet,
  ConfirmDialog,
  ContextMenu,
  EmptyState,
  PullToRefresh,
  StatusAlert,
} from "@freeanima/frontend/ui-kit/composite";
import type { ActionSheetItem } from "@freeanima/frontend/ui-kit/composite";
import {
  ThreeColumnLayout,
  useDrawerNav,
  useThreeColumnLayoutMode,
} from "@freeanima/frontend/ui-kit/layout";
import {
  useActionSheetCapability,
  useContextMenuCapability,
  useHabitatConnection,
  useNetworkOnline,
  useSubjectScope,
  SubjectScopeToggle,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { readModuleSelection, writeModuleSelection } from "@freeanima/frontend/shell-sdk";
import { m } from "@paraglide/messages";

import { EmailAccountFormDialog } from "./components/EmailAccountFormDialog.tsx";
import { EmailAccountSidebar } from "./components/EmailAccountSidebar.tsx";
import { EmailMessageDetail } from "./components/EmailMessageDetail.tsx";
import {
  deleteEmailAccount,
  fetchEmailAccounts,
  fetchEmailMessages,
  markEmailMessageRead,
  patchEmailAccount,
  readEmailMessage,
  searchEmailMessages,
  syncEmailAccount,
  type EmailAccountRow,
  type EmailMessageRow,
} from "./lib/api.ts";

function accountLabel(account: EmailAccountRow): string {
  return account.display_name || account.address;
}

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type AccountMenuState = { account: EmailAccountRow; x: number; y: number };
type MessageMenuState = { message: EmailMessageRow; x: number; y: number };
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
  const [messages, setMessages] = useState<EmailMessageRow[]>([]);
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
  const [accountMenu, setAccountMenu] = useState<AccountMenuState | null>(null);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState | null>(null);
  const [sheetMenu, setSheetMenu] = useState<SheetMenuState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailAccountRow | null>(null);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  const loadMessageDetail = useCallback(
    async (message: EmailMessageRow, accountId: number) => {
      setSelectedMessageId(message.id);
      setDetailLoading(true);
      setError("");
      if (layoutMode === "compact") setDetailOpen(true);
      writeModuleSelection("email", { accountId, messageId: message.id });
      try {
        const row = await readEmailMessage(message.id);
        setDetail(row);
        if (row.unread && !writesDisabled) {
          try {
            await markEmailMessageRead(row.id);
            setMessages((prev) =>
              prev.map((item) => (item.id === message.id ? { ...item, unread: false } : item)),
            );
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

  const loadAccounts = useCallback(async () => {
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
        const messageRows = await fetchEmailMessages({ account_id: account.id, limit: 100 });
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
  }, [loadMessageDetail, useDrawer]);

  const loadMessages = useCallback(async (accountId: number) => {
    setListLoading(true);
    setError("");
    try {
      const rows = await fetchEmailMessages({ account_id: accountId, limit: 100 });
      setMessages(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages([]);
    } finally {
      setListLoading(false);
    }
  }, []);

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

  useEffect(() => {
    setActiveAccountId(null);
    setMessages([]);
    setSelectedMessageId(null);
    setDetail(null);
    setDetailOpen(false);
    setSearchQuery("");
    void loadAccounts();
  }, [subjectKind, loadAccounts]);

  useEffect(() => {
    if (layoutMode !== "compact") {
      setDetailOpen(false);
    } else if (detail) {
      setDetailOpen(true);
    }
  }, [layoutMode, detail?.id]);

  const selectAccount = async (account: EmailAccountRow) => {
    setActiveAccountId(account.id);
    setSelectedMessageId(null);
    setDetail(null);
    setDetailOpen(false);
    setSearchQuery("");
    writeModuleSelection("email", { accountId: account.id, messageId: null });
    if (useDrawer) setListOpen(false);
    await loadMessages(account.id);
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
      setMessages(hits);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
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
        onClick: () => setDeleteTarget(account),
      });
    }
    return items;
  };

  const messageMenuItems = (message: EmailMessageRow): ActionSheetItem[] => {
    const items: ActionSheetItem[] = [];
    if (!writesDisabled && message.unread) {
      items.push({
        label: m.email_mark_read(),
        onClick: () =>
          void markEmailMessageRead(message.id)
            .then(() => {
              setMessages((prev) =>
                prev.map((row) => (row.id === message.id ? { ...row, unread: false } : row)),
              );
            })
            .catch((err) => setError(err instanceof Error ? err.message : String(err))),
      });
    }
    if (!writesDisabled && !syncing && activeAccountId != null) {
      items.push({
        label: m.email_menu_sync(),
        onClick: () => void onSync(),
      });
    }
    return items;
  };

  const openAccountMenu = (account: EmailAccountRow) => {
    if (useActionSheet) {
      setSheetMenu({ title: accountLabel(account), items: accountMenuItems(account) });
      return;
    }
    setFormState({ mode: "edit", account });
  };

  const openAccountContextMenu = (e: MouseEvent, account: EmailAccountRow) => {
    if (useActionSheet || !contextMenuEnabled) return;
    e.preventDefault();
    setAccountMenu({ account, x: e.clientX, y: e.clientY });
  };

  const openMessageContextMenu = (e: MouseEvent, message: EmailMessageRow) => {
    if (useActionSheet || !contextMenuEnabled) return;
    e.preventDefault();
    setMessageMenu({ message, x: e.clientX, y: e.clientY });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      await deleteEmailAccount(id);
      setDeleteTarget(null);
      setAccounts((prev) => prev.filter((row) => row.id !== id));
      if (activeAccountId === id) {
        setActiveAccountId(null);
        setMessages([]);
        setDetail(null);
      }
    } catch (err) {
      const errDetail = err instanceof Error ? err.message : String(err);
      setError(m.email_delete_failed({ detail: errDetail }));
      setDeleteTarget(null);
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
            message={m.email_no_messages_hint()}
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
            {messages.map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  className={`hover:bg-muted/60 w-full px-3 py-3 text-left ${
                    selectedMessageId === message.id
                      ? "bg-primary/10 ring-primary/30 ring-1 ring-inset"
                      : ""
                  }`}
                  onClick={() => void openMessage(message)}
                  onContextMenu={(e) => openMessageContextMenu(e, message)}
                >
                  <div className="flex items-start gap-2">
                    {message.unread ? (
                      <span className="bg-primary mt-1 inline-block h-2 w-2 shrink-0 rounded-full" />
                    ) : (
                      <span className="mt-1 inline-block h-2 w-2 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {message.subject || m.habitat_email_no_subject()}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">{message.from}</div>
                      <div className="text-muted-foreground mt-1 truncate text-xs">
                        {message.preview}
                      </div>
                    </div>
                    <div className="text-muted-foreground shrink-0 text-[10px]">
                      {formatWhen(message.sent_at)}
                    </div>
                  </div>
                </button>
              </li>
            ))}
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
          middleTitle={activeAccount ? accountLabel(activeAccount) : m.email_inbox_title()}
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
            ) : null
          }
          list={
            <EmailAccountSidebar
              accounts={accounts}
              activeAccountId={activeAccountId}
              writesDisabled={writesDisabled}
              useActionSheet={useActionSheet}
              onSelect={(account) => void selectAccount(account)}
              onAdd={() => setFormState({ mode: "create" })}
              onOpenMenu={openAccountMenu}
              onOpenContextMenu={openAccountContextMenu}
            />
          }
          middle={messageList}
          detail={<EmailMessageDetail loading={detailLoading} message={detail} />}
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
            void selectAccount(saved);
          }
        }}
      />

      {accountMenu ? (
        <ContextMenu
          x={accountMenu.x}
          y={accountMenu.y}
          items={accountMenuItems(accountMenu.account)}
          onClose={() => setAccountMenu(null)}
        />
      ) : null}

      {messageMenu ? (
        <ContextMenu
          x={messageMenu.x}
          y={messageMenu.y}
          items={messageMenuItems(messageMenu.message)}
          onClose={() => setMessageMenu(null)}
        />
      ) : null}

      {sheetMenu ? (
        <ActionSheet
          title={sheetMenu.title}
          items={sheetMenu.items}
          onClose={() => setSheetMenu(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        title={m.email_delete_account()}
        description={m.email_delete_confirm()}
        confirmLabel={m.email_delete_account()}
        cancelLabel={m.email_cancel()}
        variant="error"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
