import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { api } from "@/lib/api.ts";

export const Route = createFileRoute("/chamber/email")({
  loader: () =>
    api.email.overview.query().catch(() => ({ accounts: [], messages: [], errors: {} })),
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
  credential_path: string;
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

function EmailPage() {
  const initial = Route.useLoaderData() as Overview;
  const [accounts, setAccounts] = useState<EmailAccount[]>(initial.accounts ?? []);
  const [messages, setMessages] = useState<EmailMessage[]>(initial.messages ?? []);
  const [errors, setErrors] = useState<Record<string, string>>(initial.errors ?? {});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  const messagesByAccount = useMemo(() => {
    const map = new Map<string, EmailMessage[]>();
    for (const account of accounts) map.set(account.id, []);
    for (const msg of messages) {
      const list = map.get(msg.account_id) ?? [];
      list.push(msg);
      map.set(msg.account_id, list);
    }
    return map;
  }, [accounts, messages]);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = (await api.email.overview.query()) as Overview;
      setAccounts(data.accounts ?? []);
      setMessages(data.messages ?? []);
      setErrors(data.errors ?? {});
    } catch (e) {
      setError(`加载失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const onFetch = async (account: EmailAccount) => {
    setError("");
    setFetching((f) => ({ ...f, [account.id]: true }));
    try {
      const data = (await api.email.fetch.mutate({ id: account.id })) as {
        ok?: boolean;
        error?: string;
        messages?: EmailMessage[];
      };
      if (!data.ok) {
        setErrors((prev) => ({ ...prev, [account.id]: data.error ?? "拉取失败" }));
        return;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next[account.id];
        delete next._all;
        return next;
      });
      const fresh = data.messages ?? [];
      setMessages((prev) => {
        const others = prev.filter((m) => m.account_id !== account.id);
        return [...others, ...fresh];
      });
    } catch (e) {
      setError(`${account.id} 拉取失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setFetching((f) => {
        const next = { ...f };
        delete next[account.id];
        return next;
      });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold">📧 邮件</h2>
          <p className="text-sm text-base-content/60 mt-1">
            查看已配置账户与最近邮件。账户管理、发信与删信请使用 Agent 工具。
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={loading}
          onClick={() => void reload()}
        >
          刷新
        </button>
      </div>

      {errors._all ? (
        <div className="alert alert-warning text-sm mb-4">邮件加载部分失败: {errors._all}</div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-dots loading-md" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="alert alert-info text-sm">
          暂无邮件账户。请用 register_email_account 工具注册。
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => {
            const accountMessages = messagesByAccount.get(account.id) ?? [];
            return (
              <div key={account.id} className="card bg-base-200">
                <div className="card-body">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{account.display_name || account.address}</h3>
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
                    <button
                      type="button"
                      className="btn btn-xs btn-outline"
                      disabled={!!fetching[account.id]}
                      onClick={() => void onFetch(account)}
                    >
                      {fetching[account.id] ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : null}
                      拉取
                    </button>
                  </div>

                  <table className="table table-xs mb-3">
                    <tbody>
                      <tr>
                        <td className="text-base-content/50 w-24">地址</td>
                        <td className="font-mono text-xs">{account.address}</td>
                      </tr>
                      <tr>
                        <td className="text-base-content/50">凭证</td>
                        <td className="font-mono text-xs">{account.credential_path}</td>
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

                  {accountMessages.length === 0 ? (
                    <p className="text-xs text-base-content/50">暂无最近邮件。</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table table-xs">
                        <thead>
                          <tr>
                            <th>发件人</th>
                            <th>主题</th>
                            <th>时间</th>
                            <th>状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountMessages.map((msg) => (
                            <tr key={`${msg.account_id}-${msg.uid}`}>
                              <td className="max-w-[10rem] truncate">{msg.from}</td>
                              <td className="max-w-[14rem] truncate">{msg.subject}</td>
                              <td className="whitespace-nowrap">{formatDate(msg.date)}</td>
                              <td>{msg.unread ? "未读" : "已读"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error ? <div className="alert alert-error text-sm mt-4">{error}</div> : null}
    </div>
  );
}
