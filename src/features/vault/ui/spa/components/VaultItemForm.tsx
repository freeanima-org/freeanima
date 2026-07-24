import { useEffect, useState } from "react";
import { Button, FormField, Input, Spinner, Textarea } from "@freeanima/frontend/ui-kit";
import { normalizeTotpSecret } from "@freeanima/shared/vault-crypto";

export type VaultItemFormValues = {
  title: string;
  url: string;
  username: string;
  password: string;
  totp: string;
  notes: string;
};

const emptyValues = (): VaultItemFormValues => ({
  title: "",
  url: "",
  username: "",
  password: "",
  totp: "",
  notes: "",
});

export function VaultItemForm({
  mode,
  initial,
  disabled,
  loading,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: Partial<VaultItemFormValues>;
  disabled: boolean;
  loading: boolean;
  onSubmit: (values: VaultItemFormValues) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<VaultItemFormValues>(() => ({
    ...emptyValues(),
    ...initial,
  }));
  const [totpHint, setTotpHint] = useState("");

  useEffect(() => {
    if (mode === "edit" && initial) {
      setValues({ ...emptyValues(), ...initial });
    }
  }, [mode, initial]);

  const setField = <K extends keyof VaultItemFormValues>(key: K, value: VaultItemFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
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
    onSubmit({
      title,
      url: values.url.trim(),
      username: values.username.trim(),
      password: values.password,
      totp,
      notes: values.notes,
    });
    if (mode === "create") {
      setValues(emptyValues());
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{mode === "create" ? "新建条目" : "编辑条目"}</h2>
        <p className="text-sm text-muted-foreground">
          标题必填；URL、用户名、密码、TOTP 与备注可选。
        </p>
      </div>
      <FormField label="标题">
        <Input
          value={values.title}
          disabled={disabled || loading}
          autoComplete="off"
          onChange={(e) => setField("title", e.target.value)}
        />
      </FormField>
      <FormField label="网址">
        <Input
          type="url"
          placeholder="https://"
          value={values.url}
          disabled={disabled || loading}
          autoComplete="off"
          onChange={(e) => setField("url", e.target.value)}
        />
      </FormField>
      <FormField label="用户名">
        <Input
          value={values.username}
          disabled={disabled || loading}
          autoComplete="username"
          onChange={(e) => setField("username", e.target.value)}
        />
      </FormField>
      <FormField label="密码">
        <Input
          type="password"
          value={values.password}
          disabled={disabled || loading}
          autoComplete="new-password"
          onChange={(e) => setField("password", e.target.value)}
        />
      </FormField>
      <FormField label="TOTP 密钥" hint={totpHint || "Base32 密钥，或粘贴 otpauth:// URI"}>
        <Input
          value={values.totp}
          disabled={disabled || loading}
          autoComplete="off"
          spellCheck={false}
          placeholder="JBSWY3DPEHPK3PXP"
          onChange={(e) => {
            setTotpHint("");
            setField("totp", e.target.value);
          }}
        />
      </FormField>
      <FormField label="备注">
        <Textarea
          rows={3}
          value={values.notes}
          disabled={disabled || loading}
          onChange={(e) => setField("notes", e.target.value)}
        />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!values.title.trim() || disabled || loading}
          onClick={submit}
        >
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
