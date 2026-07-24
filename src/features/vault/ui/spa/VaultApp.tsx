import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getUserVaultSession,
  SubjectScopeToggle,
  useHabitatConnection,
  useNetworkOnline,
  useSubjectScope,
  VAULT_UI_SCOPE,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { Button, Card, CardContent, Input, Spinner } from "@freeanima/frontend/ui-kit";
import { ConfirmDialog, EmptyState, StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import { ListDetailLayout } from "@freeanima/frontend/ui-kit/layout";
import { m } from "@paraglide/messages";
import type { VaultItemMetaRowPayload } from "@freeanima/shared/rpc-contract";
import { extractCustomFieldNames, type VaultSecretsPayload } from "@freeanima/shared/vault-crypto";

import {
  changeVaultCryptoConfig,
  createVaultItem,
  createVaultItemPlain,
  deleteVaultItem,
  ensureAgentVaultConfig,
  fetchVaultItems,
  fetchVaultWrappedDeks,
  getVaultCryptoConfig,
  getVaultItem,
  initVaultCryptoConfig,
  patchVaultItem,
  patchVaultItemPlain,
  type VaultSecretsViewPayload,
} from "./lib/api.ts";
import { newUserVaultSalt } from "./lib/crypto-client.ts";
import { ChangeMasterPasswordDialog } from "./components/ChangeMasterPasswordDialog.tsx";
import { VaultItemDetail, type VaultDetailSecrets } from "./components/VaultItemDetail.tsx";
import { VaultItemForm, type VaultItemFormValues } from "./components/VaultItemForm.tsx";

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

function secretsFromAgentView(secrets?: VaultSecretsViewPayload): VaultDetailSecrets {
  if (!secrets) return {};
  const out: VaultDetailSecrets = {};
  if (typeof secrets.password === "string") out.password = secrets.password;
  if (typeof secrets.notes === "string") out.notes = secrets.notes;
  if (typeof secrets.totp === "string") out.totp = secrets.totp;
  const custom = secrets.custom_fields;
  if (Array.isArray(custom)) {
    out.custom_fields = custom
      .filter(
        (field): field is { name: string; value: string } =>
          !!field &&
          typeof field === "object" &&
          typeof (field as { name?: unknown }).name === "string" &&
          typeof (field as { value?: unknown }).value === "string",
      )
      .map((field) => ({ name: field.name, value: field.value }));
  }
  return out;
}

function buildSecretsPayload(
  values: VaultItemFormValues,
  existing?: VaultSecretsPayload,
): VaultSecretsPayload {
  const secrets: VaultSecretsPayload = {};
  if (values.password) secrets.password = values.password;
  if (values.notes) secrets.notes = values.notes;
  if (values.totp) secrets.totp = values.totp;
  if (existing?.custom_fields && existing.custom_fields.length > 0) {
    secrets.custom_fields = existing.custom_fields;
  }
  return secrets;
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
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [userUnlocked, setUserUnlocked] = useState(() =>
    getUserVaultSession().isUnlocked(VAULT_UI_SCOPE),
  );
  const [userSetupMode, setUserSetupMode] = useState(false);
  const [detailSecrets, setDetailSecrets] = useState<VaultDetailSecrets | null>(null);
  const [detailSecretsLoading, setDetailSecretsLoading] = useState(false);
  const [editInitial, setEditInitial] = useState<VaultItemFormValues | null>(null);
  const [editExistingSecrets, setEditExistingSecrets] = useState<VaultSecretsPayload | undefined>();
  const [selectionSubjectKind, setSelectionSubjectKind] = useState(subjectKind);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");

  if (selectionSubjectKind !== subjectKind) {
    setSelectionSubjectKind(subjectKind);
    setSelectedId(null);
    setDetailSecrets(null);
    setCreating(false);
    setEditing(false);
    setEditInitial(null);
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
        setDetailSecrets(null);
        setEditing(false);
      } else if (selectedId == null && !creating && !editing && list.length > 0) {
        const first = list[0];
        if (first) setSelectedId(first.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isUserVault, searchQuery, selectedId, subjectKind, creating, editing]);

  useEffect(() => {
    void reload();
  }, [reload, subjectKind, userUnlocked]);

  useEffect(() => {
    if (!selectedId || creating || editing) {
      if (!editing) setDetailSecrets(null);
      return;
    }
    setDetailSecretsLoading(true);
    void (async () => {
      try {
        const detail = await getVaultItem(subjectKind, selectedId, true);
        if (subjectKind === "agent") {
          setDetailSecrets(secretsFromAgentView(detail.secrets));
          return;
        }
        if (!session.isUnlocked(VAULT_UI_SCOPE)) {
          setDetailSecrets(null);
          return;
        }
        if (detail.secrets_enc && detail.dek_wrapped) {
          const secrets = await session.openSecrets(detail.secrets_enc, detail.dek_wrapped);
          setDetailSecrets({
            ...(typeof secrets.password === "string" ? { password: secrets.password } : {}),
            ...(typeof secrets.notes === "string" ? { notes: secrets.notes } : {}),
            ...(typeof secrets.totp === "string" ? { totp: secrets.totp } : {}),
            ...(secrets.custom_fields
              ? {
                  custom_fields: secrets.custom_fields.map((f) => ({
                    name: f.name,
                    value: f.value,
                  })),
                }
              : {}),
          });
        } else {
          setDetailSecrets({});
        }
      } catch (e) {
        setDetailSecrets(null);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setDetailSecretsLoading(false);
      }
    })();
  }, [selectedId, session, subjectKind, userUnlocked, creating, editing]);

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

  const handleCreateItem = async (values: VaultItemFormValues) => {
    if (writesDisabled) return;
    setActionLoading(true);
    setError("");
    try {
      const secrets = buildSecretsPayload(values);
      if (subjectKind === "user") {
        if (!session.isUnlocked(VAULT_UI_SCOPE)) throw new Error("vault_locked");
        const sealed = await session.sealSecrets(secrets);
        await createVaultItem("user", {
          title: values.title,
          item_type: "login",
          ...(values.url ? { url: values.url } : {}),
          ...(values.username ? { username: values.username } : {}),
          secrets_enc: sealed.secrets_enc,
          dek_wrapped: sealed.dek_wrapped,
          custom_field_names: extractCustomFieldNames(secrets),
        });
      } else {
        await createVaultItemPlain({
          title: values.title,
          item_type: "login",
          ...(values.url ? { url: values.url } : {}),
          ...(values.username ? { username: values.username } : {}),
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

  const openEdit = async () => {
    if (!selectedItem || writesDisabled) return;
    setActionLoading(true);
    setError("");
    try {
      const detail = await getVaultItem(subjectKind, selectedItem.id, true);
      let secrets: VaultSecretsPayload = {};
      if (subjectKind === "agent") {
        secrets = (detail.secrets ?? {}) as VaultSecretsPayload;
      } else {
        if (!session.isUnlocked(VAULT_UI_SCOPE)) throw new Error("vault_locked");
        if (detail.secrets_enc && detail.dek_wrapped) {
          secrets = await session.openSecrets(detail.secrets_enc, detail.dek_wrapped);
        }
      }
      setEditExistingSecrets(secrets);
      setEditInitial({
        title: selectedItem.title,
        url: selectedItem.url ?? "",
        username: selectedItem.username ?? "",
        password: typeof secrets.password === "string" ? secrets.password : "",
        totp: typeof secrets.totp === "string" ? secrets.totp : "",
        notes: typeof secrets.notes === "string" ? secrets.notes : "",
      });
      setEditing(true);
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePatchItem = async (values: VaultItemFormValues) => {
    if (!selectedItem || writesDisabled) return;
    setActionLoading(true);
    setError("");
    try {
      const secrets = buildSecretsPayload(values, editExistingSecrets);
      if (subjectKind === "user") {
        if (!session.isUnlocked(VAULT_UI_SCOPE)) throw new Error("vault_locked");
        const sealed = await session.sealSecrets(secrets);
        await patchVaultItem("user", {
          id: selectedItem.id,
          title: values.title,
          url: values.url,
          username: values.username,
          secrets_enc: sealed.secrets_enc,
          dek_wrapped: sealed.dek_wrapped,
          custom_field_names: extractCustomFieldNames(secrets),
        });
      } else {
        await patchVaultItemPlain({
          id: selectedItem.id,
          title: values.title,
          url: values.url,
          username: values.username,
          secrets: secrets as VaultSecretsViewPayload,
        });
      }
      setEditing(false);
      setEditInitial(null);
      setEditExistingSecrets(undefined);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedId || writesDisabled) return;
    setConfirmDeleteOpen(false);
    setActionLoading(true);
    setError("");
    try {
      await deleteVaultItem(subjectKind, selectedId);
      setSelectedId(null);
      setEditing(false);
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
    setDetailSecrets(null);
    setEditing(false);
  };

  const handleChangeMasterPassword = async (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (writesDisabled) return;
    setChangePasswordError("");
    if (input.newPassword !== input.confirmPassword) {
      setChangePasswordError("两次输入的新主密码不一致");
      return;
    }
    if (input.newPassword.length < 8) {
      setChangePasswordError("新主密码至少 8 个字符");
      return;
    }
    if (input.newPassword === input.currentPassword) {
      setChangePasswordError("新主密码不能与当前相同");
      return;
    }
    setActionLoading(true);
    try {
      const config = await getVaultCryptoConfig("user");
      if (!config?.salt || !config.verifier) {
        throw new Error("vault_config_missing");
      }
      const currentOk = await session.verifyCurrentPassword(
        input.currentPassword,
        config.salt,
        config.verifier,
      );
      if (!currentOk) {
        setChangePasswordError("当前主密码不正确");
        return;
      }
      if (!session.isUnlocked(VAULT_UI_SCOPE)) {
        await session.unlock({
          masterPassword: input.currentPassword,
          salt: config.salt,
          verifier: config.verifier,
          conversationId: VAULT_UI_SCOPE,
        });
        setUserUnlocked(true);
      }
      const wrapped = await fetchVaultWrappedDeks("user");
      const prep = await session.prepareMasterPasswordChange(input.newPassword, wrapped);
      await changeVaultCryptoConfig({
        salt: prep.salt,
        verifier: prep.verifier,
        rewrapped: prep.rewrapped,
      });
      prep.commit();
      setChangePasswordOpen(false);
      setError("");
    } catch (e) {
      setChangePasswordError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const openCreate = () => {
    setSelectedId(null);
    setCreating(true);
    setEditing(false);
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
    : editing
      ? "编辑条目"
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
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={writesDisabled || actionLoading}
              onClick={() => {
                setChangePasswordError("");
                setChangePasswordOpen(true);
              }}
            >
              修改主密码
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleLockUserVault}>
              锁定
            </Button>
          </>
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
          selectedItem && !creating && !editing ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={writesDisabled || actionLoading}
                onClick={() => void openEdit()}
              >
                编辑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={writesDisabled || actionLoading}
                onClick={() => setConfirmDeleteOpen(true)}
              >
                删除
              </Button>
            </div>
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
                    const active = item.id === selectedId && !creating && !editing;
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
                            setEditing(false);
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
            <Card className="mx-auto w-full max-w-lg">
              <CardContent className="pt-6">
                <VaultItemForm
                  mode="create"
                  disabled={writesDisabled}
                  loading={actionLoading}
                  onSubmit={(values) => void handleCreateItem(values)}
                />
              </CardContent>
            </Card>
          ) : editing && editInitial ? (
            <Card className="mx-auto w-full max-w-lg">
              <CardContent className="pt-6">
                <VaultItemForm
                  mode="edit"
                  initial={editInitial}
                  disabled={writesDisabled}
                  loading={actionLoading}
                  onSubmit={(values) => void handlePatchItem(values)}
                  onCancel={() => {
                    setEditing(false);
                    setEditInitial(null);
                    setEditExistingSecrets(undefined);
                  }}
                />
              </CardContent>
            </Card>
          ) : selectedItem ? (
            <VaultItemDetail
              item={selectedItem}
              secrets={detailSecrets}
              secretsLoading={detailSecretsLoading}
            />
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

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="删除确认"
        description={
          selectedItem ? `确定删除保险库条目「${selectedItem.title}」？此操作不可恢复。` : undefined
        }
        confirmLabel="删除"
        variant="error"
        onConfirm={() => void handleDeleteItem()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ChangeMasterPasswordDialog
        open={changePasswordOpen}
        loading={actionLoading}
        error={changePasswordError}
        onOpenChange={setChangePasswordOpen}
        onSubmit={(input) => void handleChangeMasterPassword(input)}
      />
    </div>
  );
}
