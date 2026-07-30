import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input } from "@freeanima/ui-kit";
import { EmptyState, showConfirm, StatusAlert } from "@freeanima/ui-kit/composite";
import {
  emptyVaultItemFormValues,
  normalizeFormUris,
  primaryUrlFromForm,
  VaultItemForm,
  VaultPasswordGeneratorPanel,
  VaultUnlockForm,
  type VaultItemFormValues,
} from "@freeanima/features/vault/ui/shared";
import { sendBg, type ExtVaultEditorItem, type ExtVaultListItem } from "../../runtime/messages.ts";
import { loadSettings, saveSettings } from "../../runtime/settings.ts";

type TabId = "vault" | "generator" | "options";
type Screen = { kind: "main" } | { kind: "editor"; itemId: number | null };

async function activeTabUrl(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? "";
}

function editorToForm(editor: ExtVaultEditorItem): VaultItemFormValues {
  return {
    title: editor.title,
    item_type: editor.item_type,
    username: editor.username,
    tag_ids: editor.tag_ids,
    uris: editor.uris.length > 0 ? editor.uris : [{ uri: "", match: "domain" }],
    password: editor.password,
    totp: editor.totp,
    notes: editor.notes,
    custom_fields: editor.custom_fields ?? [],
  };
}

function emptyEditorFromTab(tabUrl: string): VaultItemFormValues {
  const uri = tabUrl.startsWith("http") ? tabUrl : "";
  let title = "";
  if (uri) {
    try {
      title = new URL(uri).hostname;
    } catch {
      title = "";
    }
  }
  return {
    ...emptyVaultItemFormValues(),
    title,
    uris: uri ? [{ uri, match: "domain" }] : [{ uri: "", match: "domain" }],
  };
}

export function VaultPopupApp() {
  const [booting, setBooting] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [habitatConfigured, setHabitatConfigured] = useState(false);
  const [gateError, setGateError] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>("vault");
  const [screen, setScreen] = useState<Screen>({ kind: "main" });
  const [items, setItems] = useState<ExtVaultListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const [editorInitial, setEditorInitial] = useState<VaultItemFormValues | null>(null);
  const [editorId, setEditorId] = useState<number | undefined>();
  const [editorError, setEditorError] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);

  const [habitatUrl, setHabitatUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [optionsMsg, setOptionsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refreshStatus = useCallback(async () => {
    const status = await sendBg({ type: "get_status" });
    if (!status.ok || !("unlocked" in status)) {
      setGateError(status.ok ? "状态异常" : status.error);
      setUnlocked(false);
      return;
    }
    setUnlocked(status.unlocked);
    setHabitatConfigured(status.habitat_configured);
    setGateError("");
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshStatus();
      const s = await loadSettings();
      setHabitatUrl(s.habitat_url);
      setAuthToken(s.auth_token);
      setBooting(false);
    })();
  }, [refreshStatus]);

  const reloadList = useCallback(async (query: string) => {
    setListLoading(true);
    setListError("");
    try {
      const tabUrl = await activeTabUrl();
      const listRes = await sendBg({
        type: "list_for_tab",
        tab_url: tabUrl,
        ...(query.trim() ? { query: query.trim() } : {}),
      });
      if (!listRes.ok) {
        if (listRes.error === "vault_locked") {
          setUnlocked(false);
          return;
        }
        setListError(listRes.error);
        setItems([]);
        return;
      }
      if ("items" in listRes) setItems(listRes.items);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!unlocked || screen.kind !== "main" || activeTab !== "vault") return;
    const handle = window.setTimeout(() => {
      void reloadList(searchQuery);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [unlocked, screen.kind, activeTab, searchQuery, reloadList]);

  const filteredItems = useMemo(() => {
    if (typeFilter === "all") return items;
    return items.filter((i) => i.item_type === typeFilter);
  }, [items, typeFilter]);

  const matched = filteredItems.filter((i) => i.matched);
  const rest = filteredItems.filter((i) => !i.matched);

  const fillItem = async (id: number) => {
    const fillRes = await sendBg({ type: "get_fill_payload", item_id: id });
    if (!fillRes.ok || !("fill" in fillRes)) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: "fill_login", fill: fillRes.fill });
    window.close();
  };

  const copyField = async (id: number, field: "username" | "password" | "totp") => {
    const fillRes = await sendBg({ type: "get_fill_payload", item_id: id });
    if (!fillRes.ok || !("fill" in fillRes)) return;
    const value =
      field === "username"
        ? (fillRes.fill.username ?? "")
        : field === "password"
          ? (fillRes.fill.password ?? "")
          : (fillRes.fill.totp ?? "");
    if (value) await navigator.clipboard.writeText(value);
    setOpenMenuId(null);
  };

  const openEditor = async (itemId: number | null) => {
    setEditorError("");
    setEditorLoading(true);
    try {
      if (itemId == null) {
        setEditorId(undefined);
        setEditorInitial(emptyEditorFromTab(await activeTabUrl()));
      } else {
        const res = await sendBg({ type: "get_item", item_id: itemId });
        if (!res.ok || !("editor" in res)) {
          setEditorError(res.ok ? "加载失败" : res.error);
          setEditorId(itemId);
          setEditorInitial(emptyEditorFromTab(""));
        } else {
          setEditorId(res.editor.id);
          setEditorInitial(editorToForm(res.editor));
        }
      }
      setScreen({ kind: "editor", itemId });
    } finally {
      setEditorLoading(false);
    }
  };

  const saveEditor = async (values: VaultItemFormValues) => {
    setEditorLoading(true);
    setEditorError("");
    try {
      const uris = normalizeFormUris(values.uris);
      const res = await sendBg({
        type: "save_item",
        ...(editorId != null ? { id: editorId } : {}),
        title: values.title,
        item_type: values.item_type,
        username: values.username,
        url: primaryUrlFromForm(values),
        uris,
        tag_ids: values.tag_ids,
        password: values.password,
        notes: values.notes,
        totp: values.totp,
        custom_fields: values.custom_fields,
      });
      if (!res.ok) {
        setEditorError(res.error);
        return;
      }
      setScreen({ kind: "main" });
      setActiveTab("vault");
      setEditorInitial(null);
      await reloadList(searchQuery);
    } finally {
      setEditorLoading(false);
    }
  };

  const deleteEditor = async () => {
    if (editorId == null) return;
    const ok = await showConfirm({
      title: "删除确认",
      description: "确定删除该条目？此操作不可恢复。",
      confirmLabel: "删除",
      variant: "error",
    });
    if (!ok) return;
    setEditorLoading(true);
    const res = await sendBg({ type: "delete_item", item_id: editorId });
    setEditorLoading(false);
    if (!res.ok) {
      setEditorError(res.error);
      return;
    }
    setScreen({ kind: "main" });
    setEditorInitial(null);
    await reloadList(searchQuery);
  };

  if (booting) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (!habitatConfigured) {
    return (
      <div className="flex h-full flex-col justify-center gap-3 p-6">
        <StatusAlert variant="error">请先在选项页配置 Habitat URL 与 API Token</StatusAlert>
        <Button type="button" onClick={() => void chrome.runtime.openOptionsPage()}>
          打开选项
        </Button>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <VaultUnlockForm
        loading={unlockLoading}
        error={gateError}
        setupMode={false}
        onUnlock={(password) => {
          void (async () => {
            setUnlockLoading(true);
            setGateError("");
            const res = await sendBg({ type: "unlock", master_password: password });
            setUnlockLoading(false);
            if (!res.ok) {
              setGateError(res.error);
              return;
            }
            await refreshStatus();
          })();
        }}
        onSetup={() => undefined}
      />
    );
  }

  if (screen.kind === "editor" && editorInitial) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setScreen({ kind: "main" })}
          >
            ← 返回
          </Button>
          <h1 className="text-sm font-semibold">{editorId == null ? "新建条目" : "编辑条目"}</h1>
          {editorId != null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={editorLoading}
              onClick={() => void deleteEditor()}
            >
              删除
            </Button>
          ) : (
            <span className="w-10" />
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {editorError ? (
            <StatusAlert variant="error" className="mb-3">
              {editorError}
            </StatusAlert>
          ) : null}
          <VaultItemForm
            mode={editorId == null ? "create" : "edit"}
            initial={editorInitial}
            disabled={false}
            loading={editorLoading}
            compact
            onSubmit={(values) => void saveEditor(values)}
            onCancel={() => setScreen({ kind: "main" })}
            onGeneratePassword={async () => {
              const res = await sendBg({
                type: "generate_password",
                length: 20,
                upper: true,
                lower: true,
                digits: true,
                symbols: true,
              });
              if (!res.ok || !("password" in res)) throw new Error(res.ok ? "生成失败" : res.error);
              return res.password;
            }}
          />
        </div>
      </div>
    );
  }

  const renderRow = (item: ExtVaultListItem) => (
    <li
      key={item.id}
      className={`flex items-stretch gap-1 border-b border-border px-1 py-1 ${item.matched ? "bg-accent/40" : ""}`}
    >
      <button
        type="button"
        className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-muted"
        onClick={() => void fillItem(item.id)}
      >
        <div className="truncate text-sm font-medium">
          {item.title}
          {item.matched ? (
            <span className="ml-1 rounded bg-primary/15 px-1 text-[10px] text-primary">匹配</span>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {item.username ?? item.url ?? item.item_type}
        </div>
      </button>
      <div className="relative flex shrink-0 items-center gap-0.5">
        {item.url ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="打开链接"
            onClick={() => void chrome.tabs.create({ url: item.url })}
          >
            ↗
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="复制密码"
          onClick={() => void copyField(item.id, "password")}
        >
          ⧉
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="更多"
          onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
        >
          ⋮
        </Button>
        {openMenuId === item.id ? (
          <div className="absolute top-8 right-0 z-20 flex min-w-36 flex-col rounded-md border border-border bg-popover p-1 shadow-md">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => void openEditor(item.id)}
            >
              编辑
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => void copyField(item.id, "username")}
            >
              复制用户名
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => void copyField(item.id, "password")}
            >
              复制密码
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => void copyField(item.id, "totp")}
            >
              复制验证码
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => void fillItem(item.id)}
            >
              填充到页面
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "vault" ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
              <h1 className="text-base font-semibold">密码库</h1>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="新建"
                  onClick={() => void openEditor(null)}
                >
                  ＋
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="锁定"
                  onClick={() =>
                    void sendBg({ type: "lock" }).then(() => {
                      setUnlocked(false);
                    })
                  }
                >
                  🔒
                </Button>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 border-b border-border p-2">
              <Input
                className="min-w-0 flex-1"
                type="search"
                placeholder="搜索…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                value={typeFilter}
                aria-label="类型"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">全部类型</option>
                <option value="login">登录</option>
                <option value="secure_note">安全笔记</option>
                <option value="card">卡片</option>
                <option value="identity">身份</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {listError ? (
                <StatusAlert variant="error" className="m-2">
                  {listError}
                </StatusAlert>
              ) : null}
              {listLoading && items.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">加载中…</p>
              ) : filteredItems.length === 0 ? (
                <EmptyState
                  className="py-10"
                  message={items.length === 0 ? "保险库为空" : "无匹配结果"}
                />
              ) : (
                <>
                  {matched.length > 0 ? (
                    <>
                      <div className="flex justify-between px-3 py-1 text-xs text-muted-foreground">
                        <span>当前网站</span>
                        <span>{matched.length}</span>
                      </div>
                      <ul>{matched.map(renderRow)}</ul>
                    </>
                  ) : null}
                  <div className="flex justify-between px-3 py-1 text-xs text-muted-foreground">
                    <span>{matched.length > 0 ? "全部条目" : "条目"}</span>
                    <span>{(matched.length > 0 ? rest : filteredItems).length}</span>
                  </div>
                  <ul>{(matched.length > 0 ? rest : filteredItems).map(renderRow)}</ul>
                </>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "generator" ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-border px-3 py-2">
              <h1 className="text-base font-semibold">生成器</h1>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <VaultPasswordGeneratorPanel
                generate={async (opts) => {
                  const res = await sendBg({
                    type: "generate_password",
                    length: opts.length,
                    upper: opts.upper,
                    lower: opts.lower,
                    digits: opts.digits,
                    symbols: opts.symbols,
                  });
                  if (!res.ok || !("password" in res)) {
                    throw new Error(res.ok ? "生成失败" : res.error);
                  }
                  return res.password;
                }}
                onFill={async (password) => {
                  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                  if (!tab?.id) return;
                  await chrome.tabs.sendMessage(tab.id, {
                    type: "fill_password_only",
                    password,
                  });
                  window.close();
                }}
              />
            </div>
          </div>
        ) : null}

        {activeTab === "options" ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-border px-3 py-2">
              <h1 className="text-base font-semibold">选项</h1>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <label className="block space-y-1 text-sm">
                <span>Habitat URL</span>
                <Input
                  type="url"
                  value={habitatUrl}
                  onChange={(e) => setHabitatUrl(e.target.value)}
                  placeholder="http://127.0.0.1:2658"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>API Token</span>
                <Input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="fa_at_…"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      await saveSettings({ habitat_url: habitatUrl, auth_token: authToken });
                      setOptionsMsg({ ok: true, text: "已保存" });
                      await refreshStatus();
                    })();
                  }}
                >
                  保存
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void (async () => {
                      await saveSettings({ habitat_url: habitatUrl, auth_token: authToken });
                      const res = await sendBg({ type: "test_connection" });
                      if (res.ok && "message" in res) {
                        setOptionsMsg({ ok: true, text: res.message });
                      } else if (!res.ok) {
                        setOptionsMsg({ ok: false, text: res.error });
                      }
                    })();
                  }}
                >
                  测试连接
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void sendBg({ type: "lock" }).then(() => {
                      setUnlocked(false);
                    })
                  }
                >
                  锁定
                </Button>
              </div>
              {optionsMsg ? (
                <StatusAlert variant={optionsMsg.ok ? "success" : "error"}>
                  {optionsMsg.text}
                </StatusAlert>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <nav className="flex shrink-0 border-t border-border">
        {(
          [
            ["vault", "密码库"],
            ["generator", "生成器"],
            ["options", "选项"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 py-2.5 text-xs ${
              activeTab === id ? "font-semibold text-primary" : "text-muted-foreground"
            }`}
            onClick={() => {
              setActiveTab(id);
              setScreen({ kind: "main" });
              setOpenMenuId(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
