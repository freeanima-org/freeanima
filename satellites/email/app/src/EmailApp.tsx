import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, Button, Input, Spinner } from "@freeanima/ui-kit";
import { EmptyState, StatusAlert } from "@freeanima/ui-kit/composite";
import { useSubjectScope } from "@freeanima/shell-sdk/react";

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
import { useMobileLayout } from "./lib/platform.ts";

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
  const mobile = useMobileLayout();
  const [accounts, setAccounts] = useState<EmailAccountRow[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [messages, setMessages] = useState<EmailMessageRow[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EmailMessageRow | null>(null);
  const [view, setView] = useState<"accounts" | "inbox" | "detail">("accounts");
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

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchEmailAccounts();
      setAccounts(rows.filter((a) => a.enabled));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

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
    setView("accounts");
    void loadAccounts();
  }, [subjectKind, loadAccounts]);

  const openAccount = async (account: EmailAccountRow) => {
    setActiveAccountId(account.id);
    setSelectedMessageId(null);
    setDetail(null);
    setView("inbox");
    await loadMessages(account.id);
  };

  const openMessage = async (message: EmailMessageRow) => {
    setSelectedMessageId(message.id);
    setView("detail");
    setDetailLoading(true);
    setError("");
    try {
      const row = await readEmailMessage(message.id);
      setDetail(row);
      if (row.unread) {
        await markEmailMessageRead(row.id);
        setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, unread: false } : m)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
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
        account_id: activeAccountId ?? undefined,
        limit: 50,
      });
      setMessages(hits);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const backFromDetail = () => {
    setView("inbox");
    setSelectedMessageId(null);
    setDetail(null);
  };

  const backFromInbox = () => {
    setView("accounts");
    setActiveAccountId(null);
    setMessages([]);
    setSearchQuery("");
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (view === "accounts") {
    return (
      <div className="flex h-full flex-col">
        <header className="shrink-0 border-b px-4 py-3">
          <h1 className="text-lg font-semibold">邮箱</h1>
          <p className="mt-1 text-sm opacity-70">
            选择账户查看收件箱；账户注册请通过 Agent 工具完成。
          </p>
        </header>
        <main className="flex-1 space-y-2 overflow-auto p-4">
          {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
          {accounts.length === 0 ? (
            <EmptyState message="暂无邮件账户。" className="items-start text-left" />
          ) : (
            accounts.map((account) => (
              <Button
                key={account.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start py-3"
                onClick={() => void openAccount(account)}
              >
                <div className="text-left">
                  <div className="font-medium">{accountLabel(account)}</div>
                  <div className="text-xs opacity-70">{account.address}</div>
                </div>
              </Button>
            ))
          )}
        </main>
      </div>
    );
  }

  if (view === "detail") {
    return (
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={backFromDetail}>
            返回
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{detail?.subject ?? "邮件"}</div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">
          {detailLoading ? (
            <Spinner className="size-6" />
          ) : detail ? (
            <article className="space-y-3 text-sm">
              <div className="opacity-80">
                <div>发件人：{detail.from}</div>
                <div>收件人：{detail.to}</div>
                <div>时间：{formatWhen(detail.sent_at)}</div>
              </div>
              <pre className="wrap-break-word text-sm whitespace-pre-wrap">{detail.body}</pre>
            </article>
          ) : (
            <div className="opacity-70">无法加载邮件。</div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className={`flex h-full ${mobile ? "flex-col" : "flex-row"}`}>
      <section
        className={`flex min-h-0 flex-col border ${
          mobile ? "flex-1 border-b" : "w-96 shrink-0 border-r"
        }`}
      >
        <header className="shrink-0 space-y-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={backFromInbox}>
              账户
            </Button>
            <div className="min-w-0 flex-1 truncate font-medium">
              {activeAccount ? accountLabel(activeAccount) : "收件箱"}
            </div>
            <Button
              type="button"
              size="sm"
              disabled={syncing || activeAccountId == null}
              onClick={() => void onSync()}
            >
              {syncing ? "同步中…" : "同步"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              className="h-8 flex-1"
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
        </header>
        <div className="flex-1 overflow-auto">
          {error ? (
            <Alert variant="error" className="m-2">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          ) : null}
          {syncNotice ? (
            <Alert variant="success" className="m-2">
              <AlertDescription className="text-sm">{syncNotice}</AlertDescription>
            </Alert>
          ) : null}
          {listLoading ? (
            <div className="p-4">
              <Spinner className="size-4" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              message="暂无邮件。点击「同步」从 IMAP 拉取。"
              className="items-start p-4 text-left"
            />
          ) : (
            <ul className="divide-border divide-y">
              {messages.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    className={`hover:bg-muted/60 w-full px-3 py-3 text-left ${
                      selectedMessageId === message.id ? "bg-muted" : ""
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
                        <div className="truncate text-xs opacity-70">{message.from}</div>
                        <div className="mt-1 truncate text-xs opacity-60">{message.preview}</div>
                      </div>
                      <div className="shrink-0 text-[10px] opacity-50">
                        {formatWhen(message.sent_at)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {!mobile ? (
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b px-4 py-3 font-medium">
            {detail?.subject ?? "选择一封邮件阅读"}
          </header>
          <main className="flex-1 overflow-auto p-4">
            {detailLoading ? (
              <Spinner className="size-6" />
            ) : detail ? (
              <article className="space-y-3 text-sm">
                <div className="opacity-80">
                  <div>发件人：{detail.from}</div>
                  <div>收件人：{detail.to}</div>
                  <div>时间：{formatWhen(detail.sent_at)}</div>
                </div>
                <pre className="wrap-break-word whitespace-pre-wrap">{detail.body}</pre>
              </article>
            ) : (
              <div className="text-sm opacity-70">从左侧选择邮件。</div>
            )}
          </main>
        </section>
      ) : null}
    </div>
  );
}
