import { useEffect, useState } from "react";
import { useSubjectScope } from "@freeanima/client/portal-sdk/react.tsx";
import { Button, Input, Spinner } from "@freeanima/ui-kit";
import { StatusAlert } from "@freeanima/ui-kit/composite";

import {
  attachAddressRemote,
  createFromAddressRemote,
  getContactRemote,
  linkMessageContactRemote,
  resolveContactsByAddress,
  type ContactRow,
} from "@freeanima/features/contact/ui/spa/lib/api.ts";

type Role = "from" | "to";

type EmailContactLinkPanelProps = {
  messageId: number;
  role: Role;
  addressRaw: string;
  linkedContactId: number | null;
  writesDisabled?: boolean;
  onLinked: (next: { from_contact_id: number | null; to_contact_ids: number[] }) => void;
};

export function EmailContactLinkPanel({
  messageId,
  role,
  addressRaw,
  linkedContactId,
  writesDisabled = false,
  onLinked,
}: EmailContactLinkPanelProps) {
  const { kind: subjectKind } = useSubjectScope();
  const [linked, setLinked] = useState<ContactRow | null>(null);
  const [candidates, setCandidates] = useState<ContactRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (linkedContactId == null) {
      setLinked(null);
    } else {
      void getContactRemote(subjectKind, linkedContactId)
        .then((row) => {
          if (!cancelled) setLinked(row);
        })
        .catch(() => {
          if (!cancelled) setLinked(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [linkedContactId, subjectKind]);

  const openResolve = async () => {
    setShowPanel(true);
    setBusy(true);
    setError("");
    try {
      const items = await resolveContactsByAddress(subjectKind, addressRaw);
      setCandidates(items);
      const guess =
        addressRaw.match(/"([^"]+)"/)?.[1] ||
        addressRaw.split("<")[0]?.trim() ||
        addressRaw.split("@")[0] ||
        "";
      setNewTitle(guess.replace(/^"|"$/g, "").trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const linkExisting = async (contactId: number) => {
    setBusy(true);
    setError("");
    try {
      const result = await linkMessageContactRemote(subjectKind, {
        message_id: messageId,
        role,
        contact_id: contactId,
      });
      onLinked(result);
      setShowPanel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const attachAndLink = async (contactId: number) => {
    setBusy(true);
    setError("");
    try {
      await attachAddressRemote(subjectKind, {
        contact_id: contactId,
        address: addressRaw,
        identity_key: false,
      });
      const result = await linkMessageContactRemote(subjectKind, {
        message_id: messageId,
        role,
        contact_id: contactId,
      });
      onLinked(result);
      setShowPanel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const createAndLink = async () => {
    setBusy(true);
    setError("");
    try {
      const item = await createFromAddressRemote(subjectKind, {
        title: newTitle.trim() || "未命名联系人",
        address: addressRaw,
        identity_key: true,
        message_id: messageId,
        link_role: role,
      });
      if (role === "from") {
        onLinked({ from_contact_id: item.id, to_contact_ids: [] });
      } else {
        onLinked({ from_contact_id: null, to_contact_ids: [item.id] });
      }
      setShowPanel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const clearLink = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await linkMessageContactRemote(subjectKind, {
        message_id: messageId,
        role,
        contact_id: null,
        ...(role === "to" ? { to_contact_ids: [] } : {}),
      });
      onLinked(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1 space-y-1 text-xs">
      {linked ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">联系人：</span>
          <a className="text-primary underline" href="/contacts">
            {linked.title}
          </a>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={writesDisabled || busy}
            onClick={() => void clearLink()}
          >
            解除关联
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          isDisabled={writesDisabled || busy}
          onClick={() => void openResolve()}
        >
          关联通讯录
        </Button>
      )}

      {showPanel ? (
        <div className="border-border bg-muted/30 mt-2 space-y-2 rounded-md border p-2">
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
                    关联
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isDisabled={busy || writesDisabled}
                    onClick={() => void attachAndLink(c.id)}
                  >
                    并入邮箱并关联
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
              isDisabled={busy || writesDisabled}
              onClick={() => void createAndLink()}
            >
              新建并关联
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
