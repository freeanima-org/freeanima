import { useEffect, useState } from "react";
import { Button, FormField, Input, Spinner, Textarea } from "@freeanima/ui-kit";
import { normalizeTotpSecret, type VaultCustomField } from "@freeanima/shared/vault-crypto";
import type { VaultUriEntryPayload, VaultUriMatch } from "@freeanima/shared/rpc-contract";
import { VAULT_ITEM_COMPONENT } from "@freeanima/host/core/db/schema";
import { TagPicker } from "@freeanima/features/tag/ui/spa/components/TagPicker.tsx";

import { VAULT_ITEM_TYPE_OPTIONS, VAULT_URI_MATCH_OPTIONS } from "./uri-match.ts";

export type VaultItemType = (typeof VAULT_ITEM_TYPE_OPTIONS)[number]["value"];

export type VaultItemFormValues = {
  title: string;
  item_type: VaultItemType;
  username: string;
  tag_ids: number[];
  uris: VaultUriEntryPayload[];
  password: string;
  totp: string;
  notes: string;
  custom_fields: VaultCustomField[];
};

const emptyUri = (): VaultUriEntryPayload => ({ uri: "", match: "domain" });

export const emptyVaultItemFormValues = (): VaultItemFormValues => ({
  title: "",
  item_type: "login",
  username: "",
  tag_ids: [],
  uris: [emptyUri()],
  password: "",
  totp: "",
  notes: "",
  custom_fields: [],
});

/** 首条非空 URI，供兼容字段 url 使用 */
export function primaryUrlFromForm(values: VaultItemFormValues): string {
  return values.uris.map((u) => u.uri.trim()).find(Boolean) ?? "";
}

export function normalizeFormUris(uris: VaultUriEntryPayload[]): VaultUriEntryPayload[] {
  return uris.map((u) => ({ uri: u.uri.trim(), match: u.match })).filter((u) => u.uri.length > 0);
}

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

function showsLoginSecrets(type: VaultItemType): boolean {
  return type === "login" || type === "custom";
}

export function VaultItemForm({
  mode,
  initial,
  disabled,
  loading,
  compact,
  onSubmit,
  onCancel,
  onGeneratePassword,
}: {
  mode: "create" | "edit";
  initial?: Partial<VaultItemFormValues>;
  disabled: boolean;
  loading: boolean;
  /** 扩展弹窗等窄布局 */
  compact?: boolean;
  onSubmit: (values: VaultItemFormValues) => void;
  onCancel?: () => void;
  /** 返回生成的密码并写入表单 */
  onGeneratePassword?: () => string | Promise<string>;
}) {
  const [values, setValues] = useState<VaultItemFormValues>(() => ({
    ...emptyVaultItemFormValues(),
    ...initial,
    uris: initial?.uris?.length ? initial.uris : [emptyUri()],
    tag_ids: initial?.tag_ids ?? [],
    custom_fields: initial?.custom_fields ?? [],
  }));
  const [totpHint, setTotpHint] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !initial) return;
    setValues({
      ...emptyVaultItemFormValues(),
      ...initial,
      uris: initial.uris?.length ? initial.uris : [emptyUri()],
      tag_ids: initial.tag_ids ?? [],
      custom_fields: initial.custom_fields ?? [],
    });
  }, [mode, initial]);

  const setField = <K extends keyof VaultItemFormValues>(key: K, value: VaultItemFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const updateUri = (index: number, patch: Partial<VaultUriEntryPayload>) => {
    setValues((prev) => ({
      ...prev,
      uris: prev.uris.map((u, i) => (i === index ? { ...u, ...patch } : u)),
    }));
  };

  const submit = () => {
    const title = values.title.trim();
    if (!title || disabled || loading) return;
    const totpRaw = values.totp.trim();
    let totp = "";
    if (totpRaw) {
      totp = normalizeTotpSecret(totpRaw);
      if (!totp) {
        setTotpHint("无法识别 TOTP 密钥（支持 Base32 或 otpauth:// URI）");
        return;
      }
    }
    setTotpHint("");
    const custom_fields = values.custom_fields
      .map((f) => ({
        name: f.name.trim(),
        value: f.value,
        type: f.type ?? ("text" as const),
      }))
      .filter((f) => f.name.length > 0);
    onSubmit({
      ...values,
      title,
      username: values.username.trim(),
      tag_ids: values.tag_ids,
      uris: values.uris.map((u) => ({
        uri: u.uri.trim(),
        match: u.match,
      })),
      totp,
      notes: values.notes,
      custom_fields,
    });
    if (mode === "create") {
      setValues(emptyVaultItemFormValues());
    }
  };

  const busy = disabled || loading;

  return (
    <div className={compact ? "space-y-3" : "mx-auto w-full max-w-lg space-y-4"}>
      {!compact ? (
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{mode === "create" ? "新建条目" : "编辑条目"}</h2>
          <p className="text-sm text-muted-foreground">
            标题必填；可配置多条 URI、标签与自定义字段。
          </p>
        </div>
      ) : null}

      <FormField label="类型">
        <select
          className={selectClassName}
          value={values.item_type}
          disabled={busy}
          onChange={(e) => setField("item_type", e.target.value as VaultItemType)}
        >
          {VAULT_ITEM_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="标题">
        <Input
          value={values.title}
          disabled={busy}
          autoComplete="off"
          onChange={(e) => setField("title", e.target.value)}
        />
      </FormField>

      {showsLoginSecrets(values.item_type) ? (
        <>
          <FormField label="用户名">
            <Input
              value={values.username}
              disabled={busy}
              autoComplete="username"
              onChange={(e) => setField("username", e.target.value)}
            />
          </FormField>
          <FormField label="密码">
            <div className="flex gap-2">
              <Input
                className="flex-1"
                type="password"
                value={values.password}
                disabled={busy}
                autoComplete="new-password"
                onChange={(e) => setField("password", e.target.value)}
              />
              {onGeneratePassword ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || genLoading}
                  onClick={() => {
                    void (async () => {
                      setGenLoading(true);
                      try {
                        const password = await onGeneratePassword();
                        if (password) setField("password", password);
                      } finally {
                        setGenLoading(false);
                      }
                    })();
                  }}
                >
                  {genLoading ? <Spinner className="size-4" /> : "生成"}
                </Button>
              ) : null}
            </div>
          </FormField>
          <FormField label="TOTP 密钥" hint={totpHint || "Base32 或 otpauth:// URI"}>
            <Input
              value={values.totp}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              placeholder="JBSWY3DPEHPK3PXP"
              onChange={(e) => {
                setTotpHint("");
                setField("totp", e.target.value);
              }}
            />
          </FormField>
        </>
      ) : null}

      <FormField label="URI（可添加多条）">
        <div className="space-y-2">
          {values.uris.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                className="min-w-0 flex-1"
                type="url"
                placeholder="https://"
                value={row.uri}
                disabled={busy}
                autoComplete="off"
                onChange={(e) => updateUri(i, { uri: e.target.value })}
              />
              <select
                className={`${selectClassName} sm:w-28`}
                value={row.match}
                disabled={busy}
                aria-label="匹配方式"
                onChange={(e) => updateUri(i, { match: e.target.value as VaultUriMatch })}
              >
                {VAULT_URI_MATCH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={busy || values.uris.length <= 1}
                aria-label="删除 URI"
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    uris:
                      prev.uris.length <= 1 ? [emptyUri()] : prev.uris.filter((_, j) => j !== i),
                  }))
                }
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setValues((prev) => ({ ...prev, uris: [...prev.uris, emptyUri()] }))}
          >
            添加 URI
          </Button>
        </div>
      </FormField>

      <FormField label={values.item_type === "secure_note" ? "笔记" : "备注"}>
        <Textarea
          rows={compact ? 2 : 3}
          value={values.notes}
          disabled={busy}
          onChange={(e) => setField("notes", e.target.value)}
        />
      </FormField>

      <FormField label="标签">
        <TagPicker
          primaryComponent={VAULT_ITEM_COMPONENT}
          tagIds={values.tag_ids}
          onChange={(tag_ids) => setField("tag_ids", tag_ids)}
          mode="multi"
          readOnly={busy}
        />
      </FormField>

      <FormField label="自定义字段">
        <div className="space-y-2">
          {values.custom_fields.map((field, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                className="min-w-0 flex-1"
                placeholder="名称"
                value={field.name}
                disabled={busy}
                autoComplete="off"
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    custom_fields: prev.custom_fields.map((f, j) =>
                      j === i ? { ...f, name: e.target.value } : f,
                    ),
                  }))
                }
              />
              <Input
                className="min-w-0 flex-1"
                type={field.type === "hidden" ? "password" : "text"}
                placeholder="值"
                value={field.value}
                disabled={busy}
                autoComplete="off"
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    custom_fields: prev.custom_fields.map((f, j) =>
                      j === i ? { ...f, value: e.target.value } : f,
                    ),
                  }))
                }
              />
              <select
                className={`${selectClassName} sm:w-24`}
                value={field.type}
                disabled={busy}
                aria-label="字段类型"
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    custom_fields: prev.custom_fields.map((f, j) =>
                      j === i ? { ...f, type: e.target.value as VaultCustomField["type"] } : f,
                    ),
                  }))
                }
              >
                <option value="text">文本</option>
                <option value="hidden">隐藏</option>
                <option value="boolean">布尔</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={busy}
                aria-label="删除自定义字段"
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    custom_fields: prev.custom_fields.filter((_, j) => j !== i),
                  }))
                }
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              setValues((prev) => ({
                ...prev,
                custom_fields: [...prev.custom_fields, { name: "", value: "", type: "text" }],
              }))
            }
          >
            添加字段
          </Button>
        </div>
      </FormField>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!values.title.trim() || busy} onClick={submit}>
          {loading ? <Spinner className="size-4" /> : mode === "create" ? "保存条目" : "保存更改"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={loading} onClick={onCancel}>
            取消
          </Button>
        ) : null}
      </div>
    </div>
  );
}
