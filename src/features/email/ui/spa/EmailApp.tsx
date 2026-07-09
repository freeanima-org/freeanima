import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Input, Spinner } from "@freeanima/frontend/ui-kit";
import { EmptyState, StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import {
  ThreeColumnLayout,
  useDrawerNav,
  useThreeColumnLayoutMode,
} from "@freeanima/frontend/ui-kit/layout";
import {
  useHubConnection,
  useNetworkOnline,
  useSubjectScope,
  SubjectScopeToggle,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { readModuleSelection, writeModuleSelection } from "@freeanima/frontend/shell-sdk";

import { EmailMessageDetail } from "./components/EmailMessageDetail.tsx";
import {
  fetchEmailAccounts,
  fetchEmailMessages,
  markEmailMessageRead,
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

export function EmailApp() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const hubConnection = useHubConnection();
  const writesDisabled = !networkOnline || hubConnection !== "connected";
  const layoutMode = useThreeColumnLayoutMode();
  const useDrawer = useDrawerNav();
  const [accounts, setAccounts] = useState<EmailAccountRow[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [messages, setMessages] = useState<EmailMessageRow[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EmailMessageRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");

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
            setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, unread: false } : m)));
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
      const enabled = rows.filter((a) => a.enabled);
      setAccounts(enabled);
      if (enabled.length === 0) return;

      const stored = readModuleSelection("email");
      const fallback = enabled[0];
      const account = enabled.find((a) => a.id === stored?.accountId) ?? fallback;
      if (!account) return;

      setActiveAccountId(account.id);
      if (useDrawer) setListOpen(false);

      setListLoading(true);
      try {
        const messageRows = await fetchEmailMessages({ account_id: account.id, limit: 100 });
        setMessages(messageRows);

        const storedMessage =
          stored?.messageId != null
            ? messageRows.find((m) => m.id === stored.messageId)
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

  const onSync = async () => {
    if (activeAccountId == null) return;
    setSyncing(true);
    setError("");
    setSyncNotice("");
    try {
      const results = await syncEmailAccount(activeAccountId, 100);
      const synced = results.reduce((sum, row) => sum + row.upserted_messages, 0);
      setSyncNotice(synced > 0 ? `同步完成，新增 ${synced} 封邮件。` : "同步完成，暂无新邮件。");
      await loadMessages(activeAccountId);
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

  if (loading && accounts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  const accountSidebar = (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
      {accounts.length === 0 ? (
        <EmptyState message="暂无邮件账户。" className="items-start p-2 text-left text-sm" />
      ) : (
        <ul className="space-y-1">
          {accounts.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                className={`hover:bg-muted w-full rounded-lg px-3 py-2 text-left text-sm ${
                  activeAccountId === account.id
                    ? "bg-primary/10 ring-primary/30 ring-1 ring-inset"
                    : ""
                }`}
                onClick={() => void selectAccount(account)}
              >
                <div className="truncate font-medium">{accountLabel(account)}</div>
                <div className="text-muted-foreground truncate text-xs">{account.address}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground mt-3 px-2 text-xs">账户注册请通过 Agent 工具完成。</p>
    </div>
  );

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
          选择邮箱账户查看收件箱
        </div>
      ) : listLoading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <Spinner className="size-4" />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          message="暂无邮件。点击「同步」从 IMAP 拉取。"
          className="items-start flex-1 p-4 text-left"
        />
      ) : (
        <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
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
              >
                <div className="flex items-start gap-2">
                  {message.unread ? (
                    <span className="bg-primary mt-1 inline-block h-2 w-2 shrink-0 rounded-full" />
                  ) : (
                    <span className="mt-1 inline-block h-2 w-2 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{message.subject || "(无主题)"}</div>
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
          listTitle="邮箱"
          middleTitle={activeAccount ? accountLabel(activeAccount) : "收件箱"}
          detailTitle={detail?.subject || "(无主题)"}
          listOpen={listOpen}
          onListOpenChange={setListOpen}
          listToggleAriaLabel="打开邮箱"
          detailOpen={detailOpen}
          onDetailOpenChange={handleDetailOpenChange}
          middleActions={
            <>
              <SubjectScopeToggle />
              {activeAccount ? (
                <>
                  {listLoading || searching ? <Spinner className="size-4" /> : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={syncing || writesDisabled}
                    onClick={() => void onSync()}
                  >
                    {syncing ? "同步中…" : "同步"}
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
                  placeholder="搜索邮件"
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
                  搜
                </Button>
              </div>
            ) : null
          }
          list={accountSidebar}
          middle={messageList}
          detail={<EmailMessageDetail loading={detailLoading} message={detail} />}
        />
      )}
    </div>
  );
}
