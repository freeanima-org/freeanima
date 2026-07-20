import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getUserVaultSession,
  SubjectScopeToggle,
  useHabitatConnection,
  useNetworkOnline,
  useSubjectScope,
  VAULT_UI_SCOPE,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { Button, Card, CardContent, Input, Spinner, Textarea } from "@freeanima/frontend/ui-kit";
import { EmptyState, StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { ListDetailLayout } from "@freeanima/frontend/ui-kit/layout";
import { m } from "@paraglide/messages";
import type {
  VaultItemDetailRowPayload,
  VaultItemMetaRowPayload,
} from "@freeanima/shared/sap-contract";

import {
  createVaultItem,
  createVaultItemPlain,
  deleteVaultItem,
  ensureAgentVaultConfig,
  fetchVaultItems,
  getVaultCryptoConfig,
  getVaultItem,
  initVaultCryptoConfig,
  type VaultSecretsViewPayload,
} from "./lib/api.ts";
import { newUserVaultSalt, type VaultSecretsPayload } from "./lib/crypto-client.ts";
import { extractCustomFieldNames } from "@freeanima/shared/vault-crypto";

function LockScreen({
  loading,
  error,
  setupMode,
  onUnlock,
  onSetup,
}: {
  loading: boolean;
  error: string;
  setupMode: boolean;
  onUnlock: (password: string) => void;
  onSetup: (password: string, confirm: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-4 p-6">
      <div className="space-y-1 text-center">
        <h1 className="text-lg font-semibold">用户保险库已锁定</h1>
        <p className="text-sm text-muted-foreground">
          {setupMode ? "首次使用请设置主密码" : "输入主密码以解锁用户保险库"}
        </p>
      </div>
      {error ? <StatusAlert variant="error">{error}</StatusAlert> : null}
      <Input
        type="password"
        autoComplete="current-password"
        placeholder="主密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {setupMode ? (
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="确认主密码"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      ) : null}
      <Button
        type="button"
        disabled={loading || !password.trim()}
        onClick={() => {
          if (setupMode) onSetup(password, confirm);
          else onUnlock(password);
        }}
      >
        {loading ? <Spinner className="size-4" /> : setupMode ? "创建保险库" : "解锁"}
      </Button>
    </div>
  );
}

function secretsFromAgentView(secrets?: VaultSecretsViewPayload): string {
  if (!secrets) return "";
  const lines: string[] = [];
  if (typeof secrets.password === "string") lines.push(`密码: ${secrets.password}`);
  if (typeof secrets.notes === "string") lines.push(`备注: ${secrets.notes}`);
  if (typeof secrets.totp === "string") lines.push(`TOTP: ${secrets.totp}`);
  const custom = secrets.custom_fields;
  if (Array.isArray(custom)) {
    for (const field of custom) {
      if (field && typeof field === "object" && "name" in field && "value" in field) {
        lines.push(`${String(field.name)}: ${String(field.value)}`);
      }
    }
  }
  return lines.join("\n");
}

function VaultCreateForm({
  disabled,
  loading,
  onSubmit,
}: {
  disabled: boolean;
  loading: boolean;
  onSubmit: (input: { title: string; password: string; notes: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">新建条目</h2>
          <p className="text-sm text-muted-foreground">标题必填；密码与备注可选。</p>
        </div>
        <Input
          placeholder="标题"
          value={title}
          disabled={disabled || loading}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          type="password"
          placeholder="密码（可选）"
          value={password}
          disabled={disabled || loading}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Textarea
          placeholder="备注（可选）"
          rows={3}
          value={notes}
          disabled={disabled || loading}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button
          type="button"
          disabled={!title.trim() || disabled || loading}
          onClick={() => {
            onSubmit({ title: title.trim(), password, notes });
            setTitle("");
            setPassword("");
            setNotes("");
          }}
        >
          {loading ? <Spinner className="size-4" /> : "保存条目"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function VaultApp() {
  const { kind: subjectKind } = useSubjectScope();
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const writesDisabled = !networkOnline || habitatConnection !== "connected";

  const [items, setItems] = useState<VaultItemMetaRowPayload[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [userUnlocked, setUserUnlocked] = useState(() =>
    getUserVaultSession().isUnlocked(VAULT_UI_SCOPE),
  );
  const [userSetupMode, setUserSetupMode] = useState(false);
  const [detailSecrets, setDetailSecrets] = useState("");
  const [selectionSubjectKind, setSelectionSubjectKind] = useState(subjectKind);

  // subject 切换时在 render 阶段清空选中，避免详情 effect 用旧 ID 打到新 world
  if (selectionSubjectKind !== subjectKind) {
    setSelectionSubjectKind(subjectKind);
    setSelectedId(null);
    setDetailSecrets("");
    setCreating(false);
  }

  const session = useMemo(() => getUserVaultSession(), []);
  const isUserVault = subjectKind === "user";
  const showLockScreen = isUserVault && !userUnlocked;

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isUserVault) {
        const config = await getVaultCryptoConfig("user");
        setUserSetupMode(!config);
      } else {
        await ensureAgentVaultConfig();
      }
      const query = searchQuery.trim();
      const list = await fetchVaultItems(subjectKind, query ? { query } : {});
      setItems(list);
      if (selectedId != null && !list.some((item) => item.id === selectedId)) {
        setSelectedId(null);
        setDetailSecrets("");
      } else if (selectedId == null && !creating && list.length > 0) {
        const first = list[0];
        if (first) setSelectedId(first.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isUserVault, searchQuery, selectedId, subjectKind, creating]);

  useEffect(() => {
    void reload();
  }, [reload, subjectKind, userUnlocked]);

  useEffect(() => {
    if (!selectedId) {
      setDetailSecrets("");
      return;
    }
    setCreating(false);
    void (async () => {
      try {
        const detail = await getVaultItem(subjectKind, selectedId, true);
        if (subjectKind === "agent") {
          setDetailSecrets(secretsFromAgentView(detail.secrets));
          return;
        }
        if (!session.isUnlocked(VAULT_UI_SCOPE)) {
          setDetailSecrets("");
          return;
        }
        const enc = detail as VaultItemDetailRowPayload & {
          secrets_enc?: string;
          dek_wrapped?: string;
        };
        if (enc.secrets_enc && enc.dek_wrapped) {
          const password = await session.resolveSecret(
            selectedId,
            "password",
            enc.secrets_enc,
            enc.dek_wrapped,
          );
          const notes = await session.resolveSecret(
            selectedId,
            "notes",
            enc.secrets_enc,
            enc.dek_wrapped,
          );
          const lines = [password ? `密码: ${password}` : "", notes ? `备注: ${notes}` : ""].filter(
            Boolean,
          );
          setDetailSecrets(lines.join("\n"));
        } else {
          setDetailSecrets("");
        }
      } catch (e) {
        setDetailSecrets("");
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [selectedId, session, subjectKind, userUnlocked]);

  const handleUserUnlock = async (password: string) => {
    setActionLoading(true);
    setError("");
    try {
      const config = await getVaultCryptoConfig("user");
      if (!config?.salt || !config.verifier) {
        throw new Error("vault_config_missing");
      }
      await session.unlock({
        masterPassword: password,
        salt: config.salt,
        verifier: config.verifier,
        conversationId: VAULT_UI_SCOPE,
      });
      setUserUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUserSetup = async (password: string, confirm: string) => {
    if (password !== confirm) {
      setError("两次输入的主密码不一致");
      return;
    }
    if (password.length < 8) {
      setError("主密码至少 8 个字符");
      return;
    }
    setActionLoading(true);
    setError("");
    try {
      const salt = newUserVaultSalt();
      const { verifier } = await session.initCrypto(password, salt);
      await initVaultCryptoConfig("user", { salt, verifier });
      await session.unlock({
        masterPassword: password,
        salt,
        verifier,
        conversationId: VAULT_UI_SCOPE,
      });
      setUserSetupMode(false);
      setUserUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateItem = async (input: { title: string; password: string; notes: string }) => {
    const title = input.title.trim();
    if (!title || writesDisabled) return;
    setActionLoading(true);
    setError("");
    try {
      const secrets: VaultSecretsPayload = {
        ...(input.password ? { password: input.password } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      };
      if (subjectKind === "user") {
        if (!session.isUnlocked(VAULT_UI_SCOPE)) throw new Error("vault_locked");
        const sealed = await session.sealSecrets(secrets);
        await createVaultItem("user", {
          title,
          item_type: "login",
          secrets_enc: sealed.secrets_enc,
          dek_wrapped: sealed.dek_wrapped,
          custom_field_names: extractCustomFieldNames(secrets),
        });
      } else {
        await createVaultItemPlain({
          title,
          item_type: "login",
          secrets: secrets as VaultSecretsViewPayload,
        });
      }
      setCreating(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedId || writesDisabled) return;
    setActionLoading(true);
    setError("");
    try {
      await deleteVaultItem(subjectKind, selectedId);
      setSelectedId(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockUserVault = () => {
    session.lock(VAULT_UI_SCOPE);
    setUserUnlocked(false);
    setDetailSecrets("");
  };

  const openCreate = () => {
    setSelectedId(null);
    setCreating(true);
    setListOpen(false);
  };

  if (showLockScreen) {
    return (
      <LockScreen
        loading={actionLoading || loading}
        error={error}
        setupMode={userSetupMode}
        onUnlock={(password) => void handleUserUnlock(password)}
        onSetup={(password, confirm) => void handleUserSetup(password, confirm)}
      />
    );
  }

  const detailTitle = creating
    ? "新建条目"
    : (selectedItem?.title ?? (items.length > 0 ? "选择条目" : "保险库"));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 md:px-4 md:py-3">
        <h1 className="text-base font-semibold md:text-lg">保险库</h1>
        <SubjectScopeToggle />
        {!isUserVault ? (
          <span className="hidden text-xs text-muted-foreground sm:inline">Agent 库无需主密码</span>
        ) : null}
        {isUserVault ? (
          <Button type="button" size="sm" variant="outline" onClick={handleLockUserVault}>
            锁定
          </Button>
        ) : null}
        <span className="flex-1" />
        <Input
          className="h-8 w-full sm:h-9 sm:max-w-xs"
          placeholder="搜索…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void reload();
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          aria-label={m.habitat_common_refresh()}
          onClick={() => void reload()}
        >
          {loading ? <Spinner className="size-4" /> : m.habitat_common_refresh()}
        </Button>
      </div>

      {error ? (
        <div className="shrink-0 px-4 pt-3">
          <StatusAlert variant="error">{error}</StatusAlert>
        </div>
      ) : null}

      <ListDetailLayout
        className="min-h-0 flex-1"
        detailTitle={detailTitle}
        listTitle="条目"
        listSubtitle={loading ? "加载中…" : `共 ${items.length} 条`}
        columnSplitKey="vault"
        defaultListWidthPx={256}
        listAsideClassName="border-r bg-muted/20 shrink-0"
        listOpen={listOpen}
        onListOpenChange={setListOpen}
        listToggleAriaLabel="打开条目列表"
        detailActions={
          selectedItem && !creating ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={writesDisabled || actionLoading}
              onClick={() => void handleDeleteItem()}
            >
              删除
            </Button>
          ) : null
        }
        list={(ctx) => (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b p-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={writesDisabled || actionLoading}
                onClick={() => {
                  openCreate();
                  ctx.close();
                }}
              >
                新建条目
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : items.length === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-muted-foreground">暂无条目</p>
              ) : (
                <ul className="space-y-1">
                  {items.map((item) => {
                    const active = item.id === selectedId && !creating;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                            active
                              ? "bg-primary/10 font-medium text-foreground"
                              : "text-foreground/90"
                          }`}
                          onClick={() => {
                            setSelectedId(item.id);
                            setCreating(false);
                            ctx.close();
                          }}
                        >
                          <div className="truncate">{item.title}</div>
                          {item.username ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {item.username}
                            </div>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {ctx.isDrawer ? (
              <div className="shrink-0 border-t p-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={ctx.close}
                >
                  关闭列表
                </Button>
              </div>
            ) : null}
          </div>
        )}
      >
        <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4 md:p-6">
          {creating ? (
            <VaultCreateForm
              disabled={writesDisabled}
              loading={actionLoading}
              onSubmit={(input) => void handleCreateItem(input)}
            />
          ) : selectedItem ? (
            <Card className="mx-auto w-full max-w-2xl">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">{selectedItem.title}</h2>
                  {selectedItem.url ? (
                    <a
                      href={selectedItem.url}
                      className="text-sm text-primary break-all hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selectedItem.url}
                    </a>
                  ) : null}
                </div>
                {selectedItem.username ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground">用户名</span>
                    <p className="mt-1 font-mono text-sm">{selectedItem.username}</p>
                  </div>
                ) : null}
                {selectedItem.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {detailSecrets ? (
                  <pre className="rounded-md border bg-muted/40 p-3 font-mono text-sm whitespace-pre-wrap break-all">
                    {detailSecrets}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">正在加载隐私字段…</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              className="mx-auto max-w-md py-16"
              message={
                items.length > 0
                  ? "从左侧列表选择条目查看详情，或新建一条凭据。"
                  : "还没有保险库条目，先新建一条吧。"
              }
              action={
                <Button type="button" size="sm" disabled={writesDisabled} onClick={openCreate}>
                  新建条目
                </Button>
              }
            />
          )}
        </div>
      </ListDetailLayout>
    </div>
  );
}
