import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useUserSubjectId } from "@freeanima/client/portal-sdk/react.tsx";
import { Button, Input, Spinner } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";

import {
  attachAddressRemote,
  createFromAddressRemote,
  getContactRemote,
  patchContactRemote,
  resolveContactsByAddress,
  type ContactRow,
} from "@freeanima/features/contact/ui/spa/lib/api.ts";

type EmailContactMailboxProps = {
  addressRaw: string;
  writesDisabled?: boolean;
};

/** `Name <a@b.com>` / 多地址串 → 第一个邮箱（小写）。 */
function extractEmailAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const angle = trimmed.match(/<([^>]+)>/);
  if (angle?.[1]) {
    const inner = angle[1].trim();
    if (inner.includes("@")) return inner.toLowerCase();
  }
  const bare = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return bare?.[0]?.toLowerCase() ?? null;
}

/**
 * 邮件头展示：按通讯录邮箱实时 resolve（不落 email_message FK）。
 * 已有联系人 → `显示名 <email>`；否则原样头字段 +「关联」。
 */
export function EmailContactMailbox({
  addressRaw,
  writesDisabled = false,
}: EmailContactMailboxProps) {
  const subjectId = useUserSubjectId();
  const [linked, setLinked] = useState<ContactRow | null>(null);
  const [candidates, setCandidates] = useState<ContactRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(true);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [showPanel, setShowPanel] = useState(false);

  const email = extractEmailAddress(addressRaw);

  const refresh = useCallback(async () => {
    if (!email) {
      setLinked(null);
      setResolving(false);
      return;
    }
    setResolving(true);
    setError("");
    try {
      const items = await resolveContactsByAddress(subjectId, email);
      setLinked(items[0] ?? null);
    } catch (e) {
      setLinked(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  }, [email, subjectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openResolve = async () => {
    if (!email) return;
    setShowPanel(true);
    setBusy(true);
    setError("");
    try {
      const items = await resolveContactsByAddress(subjectId, email);
      setCandidates(items);
      const angleName = addressRaw.match(/"([^"]+)"/)?.[1];
      const beforeAngle = addressRaw.includes("<")
        ? (addressRaw.split("<")[0]?.trim().replace(/^"|"$/g, "") ?? "")
        : "";
      const guess = angleName || beforeAngle || email.split("@")[0] || "";
      setNewTitle(guess.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const afterMutate = async () => {
    setShowPanel(false);
    await refresh();
  };

  const attachAndShow = async (contactId: number) => {
    if (!email) return;
    setBusy(true);
    setError("");
    try {
      await attachAddressRemote(subjectId, {
        contact_id: contactId,
        address: email,
        identity_key: false,
      });
      await afterMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const linkExisting = async (contactId: number) => {
    // 候选已含该邮箱：仅刷新展示（身份键命中）
    setBusy(true);
    setError("");
    try {
      const row = await getContactRemote(subjectId, contactId);
      setLinked(row);
      setShowPanel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const createAndShow = async () => {
    if (!email) return;
    setBusy(true);
    setError("");
    try {
      await createFromAddressRemote(subjectId, {
        title: newTitle.trim() || "未命名联系人",
        address: email,
        identity_key: true,
      });
      await afterMutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** 从该联系人移除本邮箱通道（展示侧即不再命中）。 */
  const detachEmail = async () => {
    if (!linked || !email) return;
    setBusy(true);
    setError("");
    try {
      const nextEmails = linked.emails.filter((e) => e.value.trim().toLowerCase() !== email);
      await patchContactRemote(subjectId, linked.id, { emails: nextEmails });
      setLinked(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex max-w-full flex-col gap-1 text-sm">
      <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
        {resolving ? (
          <Spinner className="size-3.5" />
        ) : linked && email ? (
          <>
            <Link
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
              to={"/contacts" as never}
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- as never 类型对齐边界
              search={{ id: linked.id } as never}
              className="text-foreground font-medium underline-offset-2 hover:underline"
            >
              {linked.title}
            </Link>
            <span className="text-muted-foreground wrap-break-word">&lt;{email}&gt;</span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-muted-foreground h-6 px-1.5"
              isDisabled={writesDisabled || busy}
              onClick={() => void detachEmail()}
            >
              解除
            </Button>
          </>
        ) : (
          <>
            <span className="text-foreground wrap-break-word">{addressRaw || "—"}</span>
            {email ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="text-muted-foreground h-6 px-1.5"
                isDisabled={writesDisabled || busy}
                onClick={() => void openResolve()}
              >
                关联
              </Button>
            ) : null}
          </>
        )}
      </span>

      {showPanel ? (
        <div className="border-border bg-muted/30 space-y-2 rounded-md border p-2 text-xs">
          {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
          {busy ? <Spinner className="size-4" /> : null}
          {candidates.length > 0 ? (
            <ul className="space-y-1">
              {candidates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <span>{c.title}</span>
                  <Button
                    type="button"
                    size="sm"
                    isDisabled={busy || writesDisabled}
                    onClick={() => void linkExisting(c.id)}
                  >
                    选用
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isDisabled={busy || writesDisabled}
                    onClick={() => void attachAndShow(c.id)}
                  >
                    并入邮箱
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">无候选；可新建联系人。</p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
              <span>新建显示名</span>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </label>
            <Button
              type="button"
              size="sm"
              isDisabled={busy || writesDisabled || !email}
              onClick={() => void createAndShow()}
            >
              新建
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowPanel(false)}>
              关闭
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated 使用 EmailContactMailbox */
export const EmailContactLinkPanel = EmailContactMailbox;
