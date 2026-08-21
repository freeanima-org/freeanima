import { useCallback, useEffect, useState } from "react";
import { ContactRound, Plus, Search, Trash2 } from "lucide-react";
import { useUserSubjectId } from "@freeanima/client/portal-sdk/react.tsx";
import { Button, Input, Spinner, Switch } from "@freeanima/ui-kit";
import { EmptyState, StatusAlert, PullToRefresh } from "@freeanima/ui-kit/composite";

import {
  createContactRemote,
  deleteContactRemote,
  fetchContacts,
  patchContactRemote,
  type ContactChannelEntry,
  type ContactRow,
} from "./lib/api.ts";

function readUrlContactId(): number | null {
  const fromSearch = new URLSearchParams(window.location.search).get("id");
  if (fromSearch) {
    const n = Number(fromSearch);
    if (Number.isInteger(n) && n > 0) return n;
  }
  // hash history：`#/contacts?id=123`
  const hash = window.location.hash;
  const q = hash.indexOf("?");
  if (q >= 0) {
    const n = Number(new URLSearchParams(hash.slice(q + 1)).get("id"));
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

type ChannelDraft = {
  value: string;
  identity_key: boolean;
};

type Draft = {
  title: string;
  summary: string;
  emails: ChannelDraft[];
  phones: ChannelDraft[];
  wechats: ChannelDraft[];
  addresses: ChannelDraft[];
};

function emptyChannel(identityKey = false): ChannelDraft {
  return { value: "", identity_key: identityKey };
}

function emptyDraft(): Draft {
  return {
    title: "",
    summary: "",
    emails: [emptyChannel(true)],
    phones: [emptyChannel(false)],
    wechats: [emptyChannel(false)],
    addresses: [emptyChannel(false)],
  };
}

function channelsFromEntries(
  entries: ContactChannelEntry[],
  fallbackIdentity = false,
): ChannelDraft[] {
  if (entries.length === 0) return [emptyChannel(fallbackIdentity)];
  return entries.map((e) => ({ value: e.value, identity_key: e.identity_key }));
}

function draftFromRow(row: ContactRow): Draft {
  return {
    title: row.title,
    summary: row.summary,
    emails: channelsFromEntries(row.emails, true),
    phones: channelsFromEntries(row.phones),
    wechats: channelsFromEntries(row.wechats),
    addresses:
      row.addresses.length > 0
        ? row.addresses.map((a) => ({ value: a.value, identity_key: false }))
        : [emptyChannel(false)],
  };
}

function toPayloadChannels(rows: ChannelDraft[]): ContactChannelEntry[] {
  return rows
    .map((r) => ({ value: r.value.trim(), identity_key: r.identity_key }))
    .filter((r) => r.value.length > 0);
}

type ChannelKind = "emails" | "phones" | "wechats" | "addresses";

function ChannelRowsEditor(props: {
  label: string;
  kind: ChannelKind;
  rows: ChannelDraft[];
  /** 地址通道禁止身份键 */
  allowIdentityKey: boolean;
  defaultIdentityKey: boolean;
  onChange: (rows: ChannelDraft[]) => void;
}) {
  const { label, rows, allowIdentityKey, defaultIdentityKey, onChange } = props;

  const updateAt = (index: number, patch: Partial<ChannelDraft>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeAt = (index: number) => {
    if (rows.length <= 1) {
      onChange([emptyChannel(defaultIdentityKey)]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...rows, emptyChannel(defaultIdentityKey)]);
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={addRow}>
          <Plus className="size-3.5" />
          添加
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={`${props.kind}-${index}`} className="flex items-center gap-2">
            <Input
              className="min-w-0 flex-1"
              value={row.value}
              onChange={(e) => updateAt(index, { value: e.target.value })}
              placeholder={label}
              aria-label={`${label} ${index + 1}`}
            />
            {allowIdentityKey ? (
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Switch
                  size="sm"
                  aria-label="身份确认键"
                  isSelected={row.identity_key}
                  onChange={(v) => updateAt(index, { identity_key: v })}
                />
                <span>身份键</span>
              </label>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              aria-label={`删除${label}`}
              onClick={() => removeAt(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      {allowIdentityKey ? (
        <p className="text-xs text-muted-foreground">身份键须在 Commons 内该通道全局唯一。</p>
      ) : (
        <p className="text-xs text-muted-foreground">地址不能作为身份确认键。</p>
      )}
    </div>
  );
}

export function ContactApp() {
  const subjectId = useUserSubjectId();
  const [items, setItems] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(() => readUrlContactId());
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const rows = await fetchContacts(
        subjectId,
        searchQuery.trim() ? { query: searchQuery.trim(), limit: 200 } : { limit: 2000 },
      );
      setItems(rows);
      const fromUrl = readUrlContactId();
      if (fromUrl != null && rows.some((r) => r.id === fromUrl)) {
        setSelectedId(fromUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subjectId, searchQuery]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const onPop = () => {
      const id = readUrlContactId();
      if (id != null) setSelectedId(id);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("hashchange", onPop);
    };
  }, []);

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
        emails: toPayloadChannels(draft.emails),
        phones: toPayloadChannels(draft.phones),
        wechats: toPayloadChannels(draft.wechats),
        addresses: toPayloadChannels(draft.addresses).map((a) => ({
          value: a.value,
          identity_key: false as const,
        })),
      };
      if (selectedId != null) {
        const item = await patchContactRemote(subjectId, selectedId, payload);
        setItems((prev) => prev.map((r) => (r.id === item.id ? item : r)));
      } else {
        const item = await createContactRemote(subjectId, payload);
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
      await deleteContactRemote(subjectId, selectedId);
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
          <ChannelRowsEditor
            label="邮箱"
            kind="emails"
            rows={draft.emails}
            allowIdentityKey
            defaultIdentityKey
            onChange={(emails) => setDraft((d) => ({ ...d, emails }))}
          />
          <ChannelRowsEditor
            label="电话"
            kind="phones"
            rows={draft.phones}
            allowIdentityKey
            defaultIdentityKey={false}
            onChange={(phones) => setDraft((d) => ({ ...d, phones }))}
          />
          <ChannelRowsEditor
            label="微信号"
            kind="wechats"
            rows={draft.wechats}
            allowIdentityKey
            defaultIdentityKey={false}
            onChange={(wechats) => setDraft((d) => ({ ...d, wechats }))}
          />
          <ChannelRowsEditor
            label="地址"
            kind="addresses"
            rows={draft.addresses}
            allowIdentityKey={false}
            defaultIdentityKey={false}
            onChange={(addresses) => setDraft((d) => ({ ...d, addresses }))}
          />
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
