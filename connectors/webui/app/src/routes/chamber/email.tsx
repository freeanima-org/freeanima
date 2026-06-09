import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  fetchEmailAccount,
  getEmailMessage,
  getEmailOverview,
  listAccountMessages,
  markEmailRead,
} from "@/lib/api.ts";

export const Route = createFileRoute("/chamber/email")({
  loader: () => getEmailOverview().catch(() => ({ accounts: [], messages: [], errors: {} })),
  component: EmailPage,
});

type EmailAccount = {
  id: string;
  address: string;
  display_name?: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  default_sender?: boolean;
  enabled?: boolean;
  desc?: string;
  password: string;
};

type EmailMessage = {
  uid: number;
  account_id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  preview: string;
  unread: boolean;
  body?: string;
};

type Overview = {
  accounts: EmailAccount[];
  messages: EmailMessage[];
  errors: Record<string, string>;
};

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function accountLabel(account: EmailAccount) {
  return account.display_name || account.address;
}

function EmailPage() {
  const initial = Route.useLoaderData() as Overview;
  const [accounts, setAccounts] = useState<EmailAccount[]>(initial.accounts ?? []);
  const [errors, setErrors] = useState<Record<string, string>>(initial.errors ?? {});
  const [view, setView] = useState<"picker" | "reader">("picker");
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [detail, setDetail] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = (await getEmailOverview()) as Overview;
      setAccounts(data.accounts ?? []);
      setErrors(data.errors ?? {});
    } catch (e) {
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (accountId: string) => {
    setListLoading(true);
    setError("");
    try {
      const data = (await listAccountMessages(accountId, 50)) as {
        ok?: boolean;
        error?: string;
        messages?: EmailMessage[];
      };
      if (!data.ok) {
        setErrors((prev) => ({ ...prev, [accountId]: data.error ?? "加载失败" }));
        setMessages([]);
        return;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      setMessages(data.messages ?? []);
    } catch (e) {
      setError(`邮件列表加载失败: ${e instanceof Error ? e.message : String(e)}`);
      setMessages([]);
    } finally {
      setListLoading(false);
    }
  };

  const enterReader = async (account: EmailAccount) => {
    setActiveAccountId(account.id);
    setSelectedUid(null);
    setDetail(null);
    setView("reader");
    await loadMessages(account.id);
  };

  const backToPicker = () => {
    setView("picker");
    setActiveAccountId(null);
    setSelectedUid(null);
    setDetail(null);
    setMessages([]);
  };

  const switchAccount = async (accountId: string) => {
    setActiveAccountId(accountId);
    setSelectedUid(null);
    setDetail(null);
    await loadMessages(accountId);
  };

  const onFetch = async () => {
    if (!activeAccountId) return;
    setError("");
    setFetching(true);
    try {
      const data = (await fetchEmailAccount(activeAccountId)) as {
        ok?: boolean;
        error?: string;
        messages?: EmailMessage[];
      };
      if (!data.ok) {
        setErrors((prev) => ({ ...prev, [activeAccountId]: data.error ?? "拉取失败" }));
        return;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next[activeAccountId];
        return next;
      });
      setMessages(data.messages ?? []);
      if (selectedUid !== null && !data.messages?.some((m) => m.uid === selectedUid)) {
        setSelectedUid(null);
        setDetail(null);
      }
    } catch (e) {
      setError(`拉取失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setFetching(false);
    }
  };

  const selectMessage = async (msg: EmailMessage) => {
    if (!activeAccountId) return;
    setSelectedUid(msg.uid);
    setDetailLoading(true);
    setError("");
    try {
      const data = (await getEmailMessage(activeAccountId, msg.uid)) as {
        ok?: boolean;
        error?: string;
        message?: EmailMessage;
      };
      if (!data.ok || !data.message) {
        setError(data.error ?? "读取邮件失败");
        setDetail(null);
        return;
      }
      setDetail(data.message);
      if (msg.unread) {
        const readResult = (await markEmailRead(activeAccountId, msg.uid)) as { ok?: boolean };
        if (readResult.ok) {
          setMessages((prev) => prev.map((m) => (m.uid === msg.uid ? { ...m, unread: false } : m)));
        }
      }
    } catch (e) {
      setError(`读取邮件失败: ${e instanceof Error ? e.message : String(e)}`);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const isReader = view === "reader" && activeAccount !== null;

  return (
    <div className={isReader ? "h-full flex flex-col min-h-0 overflow-hidden" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold">📧 邮件</h2>
          <p className="text-sm text-base-content/60 mt-1">
            {view === "picker"
              ? "选择邮箱账户进入收件箱。账户管理、发信与删信请使用 Agent 工具。"
              : "查看收件箱邮件。账户管理、发信与删信请使用 Agent 工具。"}
          </p>
        </div>
        <div className="flex gap-2">
          {view === "reader" ? (
            <button type="button" className="btn btn-sm btn-ghost" onClick={backToPicker}>
              ← 返回账户
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={loading}
            onClick={() => void reload()}
          >
            刷新
          </button>
        </div>
      </div>

      {errors._all ? (
        <div className="alert alert-warning text-sm mb-4 shrink-0">
          邮件加载部分失败: {errors._all}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-dots loading-md" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="alert alert-info text-sm">
          暂无邮件账户。请用 register_email_account 工具注册。
        </div>
      ) : view === "picker" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <div key={account.id} className="card bg-base-200">
              <div className="card-body">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="font-bold">{accountLabel(account)}</h3>
                  <span className="badge badge-sm badge-ghost font-mono">{account.id}</span>
                  {account.default_sender ? (
                    <span className="badge badge-sm badge-primary">默认发件</span>
                  ) : null}
                  {account.enabled === false ? (
                    <span className="badge badge-sm badge-ghost">已禁用</span>
                  ) : (
                    <span className="badge badge-sm badge-success">启用</span>
                  )}
                </div>

                <table className="table table-xs mb-3">
                  <tbody>
                    <tr>
                      <td className="text-base-content/50 w-20">地址</td>
                      <td className="font-mono text-xs">{account.address}</td>
                    </tr>
                    <tr>
                      <td className="text-base-content/50">SMTP</td>
                      <td className="font-mono text-xs">
                        {account.smtp_host}:{account.smtp_port}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-base-content/50">IMAP</td>
                      <td className="font-mono text-xs">
                        {account.imap_host}:{account.imap_port}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {errors[account.id] ? (
                  <div className="alert alert-error text-xs py-2 mb-2">{errors[account.id]}</div>
                ) : null}

                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={account.enabled === false}
                  onClick={() => void enterReader(account)}
                >
                  进入邮箱
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : activeAccount ? (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 border border-base-300 rounded-lg overflow-hidden">
          <div className="flex flex-col min-h-0 overflow-hidden bg-base-200/50 max-lg:flex-1 lg:w-80 lg:min-w-[280px] lg:shrink-0 lg:border-r border-base-300 max-lg:border-b">
            <div className="shrink-0 p-3 border-b border-base-300 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm truncate">{accountLabel(activeAccount)}</span>
                <button
                  type="button"
                  className="btn btn-xs btn-outline shrink-0"
                  disabled={fetching}
                  onClick={() => void onFetch()}
                >
                  {fetching ? <span className="loading loading-spinner loading-xs" /> : null}
                  拉取
                </button>
              </div>
              {accounts.length > 1 ? (
                <select
                  className="select select-bordered select-xs w-full"
                  value={activeAccountId ?? ""}
                  onChange={(e) => void switchAccount(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.enabled === false}>
                      {accountLabel(a)}
                    </option>
                  ))}
                </select>
              ) : null}
              {errors[activeAccount.id] ? (
                <p className="text-xs text-error">{errors[activeAccount.id]}</p>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto">
              {listLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-dots loading-sm" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-xs text-base-content/50 p-3">
                  暂无邮件，点击「拉取」从服务器同步。
                </p>
              ) : (
                <div className="divide-y divide-base-300">
                  {messages.map((msg) => (
                    <button
                      key={msg.uid}
                      type="button"
                      className={[
                        "w-full text-left px-3 py-2.5 hover:bg-base-300/60 transition-colors",
                        selectedUid === msg.uid ? "sidebar-nav-active" : "",
                      ].join(" ")}
                      onClick={() => void selectMessage(msg)}
                    >
                      <div className="flex items-start gap-2">
                        {msg.unread ? (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        ) : (
                          <span className="w-2 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{msg.from}</div>
                          <div className="text-sm truncate">{msg.subject || "(无主题)"}</div>
                          <div className="text-xs text-base-content/50 mt-0.5">
                            {formatDate(msg.date)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-base-100">
            {detailLoading ? (
              <div className="flex justify-center items-center flex-1 min-h-0">
                <span className="loading loading-dots loading-md" />
              </div>
            ) : detail ? (
              <>
                <div className="shrink-0 p-4 border-b border-base-300">
                  <h3 className="font-bold text-base">{detail.subject || "(无主题)"}</h3>
                  <div className="text-sm text-base-content/70 mt-2 space-y-1">
                    <div>
                      <span className="text-base-content/50">发件人：</span>
                      {detail.from}
                    </div>
                    <div>
                      <span className="text-base-content/50">收件人：</span>
                      {detail.to}
                    </div>
                    <div>
                      <span className="text-base-content/50">时间：</span>
                      {formatDate(detail.date)}
                    </div>
                  </div>
                </div>
                <pre className="flex-1 min-h-0 overflow-y-auto p-4 text-sm whitespace-pre-wrap font-sans">
                  {detail.body || detail.preview || "(无正文)"}
                </pre>
              </>
            ) : (
              <div className="flex justify-center items-center flex-1 min-h-0 text-sm text-base-content/50">
                选择左侧邮件查看正文
              </div>
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className={`alert alert-error text-sm shrink-0 ${isReader ? "mt-2" : "mt-4"}`}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
