import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  FormToggle,
  Input,
  Spinner,
} from "@freeanima/ui-kit";
import { m } from "@paraglide/messages";

import {
  createEmailAccount,
  fetchEmailProviders,
  patchEmailAccount,
  type EmailAccountCreateInput,
  type EmailAccountPatchInput,
  type EmailAccountRow,
  type EmailProviderId,
  type EmailProviderPreset,
} from "../lib/api.ts";

export type EmailAccountFormMode = "create" | "edit";

type EmailAccountFormDialogProps = {
  open: boolean;
  mode: EmailAccountFormMode;
  account?: EmailAccountRow | null;
  disabled?: boolean;
  onClose: () => void;
  onSaved: (account: EmailAccountRow) => void;
};

type FormState = {
  provider: EmailProviderId;
  address: string;
  display_name: string;
  password: string;
  smtp_host: string;
  smtp_port: string;
  imap_host: string;
  imap_port: string;
  default_sender: boolean;
  enabled: boolean;
};

function emptyForm(): FormState {
  return {
    provider: "custom",
    address: "",
    display_name: "",
    password: "",
    smtp_host: "",
    smtp_port: "",
    imap_host: "",
    imap_port: "",
    default_sender: false,
    enabled: true,
  };
}

function formFromAccount(account: EmailAccountRow): FormState {
  return {
    provider: "custom",
    address: account.address,
    display_name: account.display_name === account.address ? "" : account.display_name,
    password: "",
    smtp_host: account.smtp_host,
    smtp_port: String(account.smtp_port),
    imap_host: account.imap_host,
    imap_port: String(account.imap_port),
    default_sender: account.default_sender,
    enabled: account.enabled,
  };
}

function applyPreset(
  provider: EmailProviderId,
  presets: EmailProviderPreset[],
): Partial<FormState> {
  if (provider === "custom") return { provider };
  const preset = presets.find((p) => p.id === provider);
  if (!preset) return { provider };
  return {
    provider,
    smtp_host: preset.smtp_host,
    smtp_port: String(preset.smtp_port),
    imap_host: preset.imap_host,
    imap_port: String(preset.imap_port),
  };
}

function parsePort(raw: string): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

export function EmailAccountFormDialog({
  open,
  mode,
  account,
  disabled = false,
  onClose,
  onSaved,
}: EmailAccountFormDialogProps) {
  const [providers, setProviders] = useState<EmailProviderPreset[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(mode === "edit" && account ? formFromAccount(account) : emptyForm());
    void fetchEmailProviders()
      .then(setProviders)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [open, mode, account]);

  const onProviderChange = (provider: EmailProviderId) => {
    setForm((prev) => ({ ...prev, ...applyPreset(provider, providers) }));
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const smtp_port = parsePort(form.smtp_port);
      const imap_port = parsePort(form.imap_port);
      if (mode === "create") {
        if (!form.password.trim()) {
          throw new Error(m.email_password_required());
        }
        const input: EmailAccountCreateInput = {
          address: form.address.trim(),
          password: form.password.trim(),
          provider: form.provider,
          default_sender: form.default_sender,
          enabled: form.enabled,
        };
        if (form.display_name.trim()) input.display_name = form.display_name.trim();
        if (form.provider === "custom") {
          input.smtp_host = form.smtp_host.trim();
          input.imap_host = form.imap_host.trim();
          if (smtp_port != null) input.smtp_port = smtp_port;
          if (imap_port != null) input.imap_port = imap_port;
        } else {
          if (form.smtp_host.trim()) input.smtp_host = form.smtp_host.trim();
          if (form.imap_host.trim()) input.imap_host = form.imap_host.trim();
          if (smtp_port != null) input.smtp_port = smtp_port;
          if (imap_port != null) input.imap_port = imap_port;
        }
        const saved = await createEmailAccount(input);
        onSaved(saved);
        onClose();
      } else if (account) {
        const input: EmailAccountPatchInput = {
          id: account.id,
          address: form.address.trim(),
          provider: form.provider,
          default_sender: form.default_sender,
          enabled: form.enabled,
          display_name: form.display_name.trim() || form.address.trim(),
          smtp_host: form.smtp_host.trim(),
          imap_host: form.imap_host.trim(),
        };
        if (form.password.trim()) input.password = form.password.trim();
        if (smtp_port != null) input.smtp_port = smtp_port;
        if (imap_port != null) input.imap_port = imap_port;
        const saved = await patchEmailAccount(input);
        onSaved(saved);
        onClose();
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(
        mode === "create" ? m.email_create_failed({ detail }) : m.email_update_failed({ detail }),
      );
    } finally {
      setSaving(false);
    }
  };

  const showHosts = form.provider === "custom";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto safe-area-pt safe-area-pb">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? m.email_add_account() : m.email_edit_account()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <FormField label={m.email_provider()} hint={m.email_provider_hint()}>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={form.provider}
              disabled={disabled || saving}
              onChange={(e) => onProviderChange(e.target.value as EmailProviderId)}
            >
              <option value="custom">{m.email_provider_custom()}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={m.habitat_email_address()}>
            <Input
              type="email"
              value={form.address}
              disabled={disabled || saving}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            />
          </FormField>

          <FormField label={m.email_display_name()}>
            <Input
              value={form.display_name}
              disabled={disabled || saving}
              onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
            />
          </FormField>

          <FormField label={m.email_password()} hint={m.email_password_hint()}>
            <Input
              type="password"
              autoComplete="off"
              value={form.password}
              disabled={disabled || saving}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </FormField>

          {(showHosts || mode === "edit") && (
            <FormField label={m.email_advanced_hosts()}>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={m.email_imap_host()}
                  value={form.imap_host}
                  disabled={disabled || saving}
                  onChange={(e) => setForm((prev) => ({ ...prev, imap_host: e.target.value }))}
                />
                <Input
                  placeholder={m.email_imap_port()}
                  value={form.imap_port}
                  disabled={disabled || saving}
                  onChange={(e) => setForm((prev) => ({ ...prev, imap_port: e.target.value }))}
                />
                <Input
                  placeholder={m.email_smtp_host()}
                  value={form.smtp_host}
                  disabled={disabled || saving}
                  onChange={(e) => setForm((prev) => ({ ...prev, smtp_host: e.target.value }))}
                />
                <Input
                  placeholder={m.email_smtp_port()}
                  value={form.smtp_port}
                  disabled={disabled || saving}
                  onChange={(e) => setForm((prev) => ({ ...prev, smtp_port: e.target.value }))}
                />
              </div>
            </FormField>
          )}

          <FormToggle
            label={m.habitat_email_default_sender()}
            checked={form.default_sender}
            disabled={disabled || saving}
            onChange={(checked) => setForm((prev) => ({ ...prev, default_sender: checked }))}
          />
          <FormToggle
            label={m.habitat_email_enabled()}
            checked={form.enabled}
            disabled={disabled || saving}
            onChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            {m.email_cancel()}
          </Button>
          <Button
            type="button"
            disabled={disabled || saving || !form.address.trim()}
            onClick={() => void submit()}
          >
            {saving ? <Spinner className="size-4" /> : m.email_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
