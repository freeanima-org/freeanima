import { useCallback, useEffect, useState } from "react";
import { ContactRound, Plus, Search, Trash2 } from "lucide-react";
import { useSubjectScope } from "@freeanima/client/portal-sdk/react.tsx";
import { Button, Checkbox, Input, Spinner, Textarea } from "@freeanima/ui-kit";
import { EmptyState, StatusAlert, PullToRefresh } from "@freeanima/ui-kit/composite";

import {
  createContactRemote,
  deleteContactRemote,
  fetchContacts,
  patchContactRemote,
  type ContactChannelEntry,
  type ContactRow,
} from "./lib/api.ts";

type Draft = {
  title: string;
  summary: string;
  emailsText: string;
  phonesText: string;
  wechatsText: string;
  addressesText: string;
  emailIdentity: boolean;
};

function emptyDraft(): Draft {
  return {
    title: "",
    summary: "",
    emailsText: "",
    phonesText: "",
    wechatsText: "",
    addressesText: "",
    emailIdentity: true,
  };
}

function linesToChannels(text: string, identityKey: boolean): ContactChannelEntry[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => ({ value, identity_key: identityKey }));
}

function channelsToText(entries: ContactChannelEntry[]): string {
  return entries.map((e) => e.value).join("\n");
}

function draftFromRow(row: ContactRow): Draft {
  return {
    title: row.title,
    summary: row.summary,
    emailsText: channelsToText(row.emails),
    phonesText: channelsToText(row.phones),
    wechatsText: channelsToText(row.wechats),
    addressesText: row.addresses.map((a) => a.value).join("\n"),
    emailIdentity: row.emails.some((e) => e.identity_key),
  };
}

export function ContactApp() {
  const { kind: subjectKind } = useSubjectScope();
  const [items, setItems] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const rows = await fetchContacts(
        subjectKind,
        searchQuery.trim() ? { query: searchQuery.trim(), limit: 200 } : { limit: 2000 },
      );
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subjectKind, searchQuery]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const selected = selectedId != null ? items.find((i) => i.id === selectedId) : null;

  useEffect(() => {
    if (selected) setDraft(draftFromRow(selected));
  }, [selected]);

  const startCreate = () => {
    setSelectedId(null);
    setDraft(emptyDraft());
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: draft.title.trim() || "未命名联系人",
        summary: draft.summary.trim(),
        emails: linesToChannels(draft.emailsText, draft.emailIdentity),
        phones: linesToChannels(draft.phonesText, false),
        wechats: linesToChannels(draft.wechatsText, false),
        addresses: draft.addressesText
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((value) => ({ value, identity_key: false })),
      };
      if (selectedId != null) {
        const item = await patchContactRemote(subjectKind, selectedId, payload);
        setItems((prev) => prev.map((r) => (r.id === item.id ? item : r)));
      } else {
        const item = await createContactRemote(subjectKind, payload);
        setItems((prev) => [item, ...prev].toSorted((a, b) => a.title.localeCompare(b.title)));
        setSelectedId(item.id);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (selectedId == null) return;
    setSaving(true);
    setError("");
    try {
      await deleteContactRemote(subjectKind, selectedId);
      setSelectedId(null);
      setDraft(emptyDraft());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">通讯录</h1>
          <p className="text-sm text-muted-foreground">
            Commons 共享联系人；主人可直接维护，agent 写入需 Commons write grant。
          </p>
        </div>
        <Button type="button" onClick={startCreate}>
          <Plus className="size-4" />
          新建联系人
        </Button>
      </div>

      <div className="relative min-w-[12rem] max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          value={searchQuery}
          placeholder="搜索姓名或通道"
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(14rem,20rem)_1fr]">
        <PullToRefresh
          onRefresh={async () => {
            await load();
          }}
          className="border-border flex min-h-0 flex-col overflow-hidden rounded-md border"
        >
          {loading ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <Spinner className="size-6" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ContactRound className="size-8" />}
              message="暂无联系人。新建或从邮件关联创建。"
            />
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`hover:bg-muted/60 flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${
                      selectedId === item.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="font-medium">{item.title || "未命名"}</span>
                    <span className="text-muted-foreground line-clamp-1 text-xs">
                      {item.emails.map((e) => e.value).join(", ") || item.summary || "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PullToRefresh>

        <div className="border-border flex min-h-0 flex-col gap-3 overflow-y-auto rounded-md border p-4">
          <h2 className="text-base font-medium">
            {selectedId != null ? "编辑联系人" : "新建联系人"}
          </h2>
          <label className="flex flex-col gap-1 text-sm">
            <span>显示名</span>
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="姓名或组织"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>备注</span>
            <Input
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>邮箱（每行一个）</span>
            <Textarea
              value={draft.emailsText}
              onChange={(e) => setDraft((d) => ({ ...d, emailsText: e.target.value }))}
              rows={3}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              isSelected={draft.emailIdentity}
              onChange={(v) => setDraft((d) => ({ ...d, emailIdentity: v }))}
            />
            <span>邮箱作为身份确认键（须全局唯一）</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>电话</span>
            <Textarea
              value={draft.phonesText}
              onChange={(e) => setDraft((d) => ({ ...d, phonesText: e.target.value }))}
              rows={2}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>微信号</span>
            <Textarea
              value={draft.wechatsText}
              onChange={(e) => setDraft((d) => ({ ...d, wechatsText: e.target.value }))}
              rows={2}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>地址</span>
            <Textarea
              value={draft.addressesText}
              onChange={(e) => setDraft((d) => ({ ...d, addressesText: e.target.value }))}
              rows={2}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" isDisabled={saving} onClick={() => void save()}>
              {saving ? "保存中…" : "保存"}
            </Button>
            {selectedId != null ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                isDisabled={saving}
                onClick={() => void remove()}
              >
                <Trash2 className="size-4" />
                删除
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
