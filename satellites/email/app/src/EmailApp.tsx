import { useCallback, useEffect, useMemo, useState } from "react";
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
      <div className="h-full flex items-center justify-center p-6">
        <span className="loading loading-spinner loading-md" />
      </div>
    );
  }

  if (view === "accounts") {
    return (
      <div className="h-full flex flex-col">
        <header className="shrink-0 border-b border-base-300 px-4 py-3">
          <h1 className="text-lg font-semibold">邮箱</h1>
          <p className="text-sm opacity-70 mt-1">
            选择账户查看收件箱；账户注册请通过 Agent 工具完成。
          </p>
        </header>
        <main className="flex-1 overflow-auto p-4 space-y-2">
          {error ? <div className="alert alert-error text-sm">{error}</div> : null}
          {accounts.length === 0 ? (
            <div className="text-sm opacity-70">暂无邮件账户。</div>
          ) : (
            accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                className="btn btn-outline w-full justify-start h-auto py-3"
                onClick={() => void openAccount(account)}
              >
                <div className="text-left">
                  <div className="font-medium">{accountLabel(account)}</div>
                  <div className="text-xs opacity-70">{account.address}</div>
                </div>
              </button>
            ))
          )}
        </main>
      </div>
    );
  }

  if (view === "detail") {
    return (
      <div className="h-full flex flex-col">
        <header className="shrink-0 border-b border-base-300 px-3 py-2 flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={backFromDetail}>
            返回
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{detail?.subject ?? "邮件"}</div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4">
          {detailLoading ? (
            <span className="loading loading-spinner loading-md" />
          ) : detail ? (
            <article className="space-y-3 text-sm">
              <div className="opacity-80">
                <div>发件人：{detail.from}</div>
                <div>收件人：{detail.to}</div>
                <div>时间：{formatWhen(detail.sent_at)}</div>
              </div>
              <pre className="whitespace-pre-wrap wrap-break-word text-sm">{detail.body}</pre>
            </article>
          ) : (
            <div className="opacity-70">无法加载邮件。</div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className={`h-full flex ${mobile ? "flex-col" : "flex-row"}`}>
      <section
        className={`flex flex-col min-h-0 border-base-300 ${
          mobile ? "flex-1 border-b" : "w-96 shrink-0 border-r"
        }`}
      >
        <header className="shrink-0 border-b border-base-300 px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={backFromInbox}>
              账户
            </button>
            <div className="min-w-0 flex-1 font-medium truncate">
              {activeAccount ? accountLabel(activeAccount) : "收件箱"}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={syncing || activeAccountId == null}
              onClick={() => void onSync()}
            >
              {syncing ? "同步中…" : "同步"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="input input-sm input-bordered flex-1"
              placeholder="搜索邮件"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSearch();
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-outline"
              disabled={searching}
              onClick={() => void onSearch()}
            >
              搜
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          {error ? <div className="alert alert-error m-2 text-sm">{error}</div> : null}
          {syncNotice ? <div className="alert alert-success m-2 text-sm">{syncNotice}</div> : null}
          {listLoading ? (
            <div className="p-4">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : messages.length === 0 ? (
            <div className="p-4 text-sm opacity-70">暂无邮件。点击「同步」从 IMAP 拉取。</div>
          ) : (
            <ul className="divide-y divide-base-300">
              {messages.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-3 hover:bg-base-200/60 ${
                      selectedMessageId === message.id ? "bg-base-200" : ""
                    }`}
                    onClick={() => void openMessage(message)}
                  >
                    <div className="flex items-start gap-2">
                      {message.unread ? (
                        <span className="mt-1 inline-block h-2 w-2 rounded-full bg-primary shrink-0" />
                      ) : (
                        <span className="mt-1 inline-block h-2 w-2 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{message.subject || "(无主题)"}</div>
                        <div className="text-xs opacity-70 truncate">{message.from}</div>
                        <div className="text-xs opacity-60 truncate mt-1">{message.preview}</div>
                      </div>
                      <div className="text-[10px] opacity-50 shrink-0">
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
        <section className="flex-1 min-w-0 flex flex-col">
          <header className="shrink-0 border-b border-base-300 px-4 py-3 font-medium">
            {detail?.subject ?? "选择一封邮件阅读"}
          </header>
          <main className="flex-1 overflow-auto p-4">
            {detailLoading ? (
              <span className="loading loading-spinner loading-md" />
            ) : detail ? (
              <article className="space-y-3 text-sm">
                <div className="opacity-80">
                  <div>发件人：{detail.from}</div>
                  <div>收件人：{detail.to}</div>
                  <div>时间：{formatWhen(detail.sent_at)}</div>
                </div>
                <pre className="whitespace-pre-wrap wrap-break-word">{detail.body}</pre>
              </article>
            ) : (
              <div className="opacity-70 text-sm">从左侧选择邮件。</div>
            )}
          </main>
        </section>
      ) : null}
    </div>
  );
}
