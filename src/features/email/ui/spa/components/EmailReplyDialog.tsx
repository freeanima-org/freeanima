import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Spinner,
  Textarea,
} from "@freeanima/ui-kit";
import { m } from "@paraglide/messages";

import { sendEmailMessage, type EmailMessageRow } from "../lib/api.ts";

function extractAddress(raw: string): string {
  const angle = raw.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  return raw.trim();
}

function replySubject(subject: string): string {
  const trimmed = subject.trim();
  if (!trimmed) return "Re: ";
  return /^re:\s/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function quotedBody(message: EmailMessageRow): string {
  const when = message.sent_at ? new Date(message.sent_at).toLocaleString() : "";
  const header = when ? `On ${when}, ${message.from} wrote:` : `${message.from} wrote:`;
  const quote = (message.body || "")
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `\n\n${header}\n${quote}`;
}

type EmailReplyDialogProps = {
  open: boolean;
  message: EmailMessageRow | null;
  accountId: number | null;
  disabled?: boolean;
  onClose: () => void;
  onSent?: () => void;
};

export function EmailReplyDialog({
  open,
  message,
  accountId,
  disabled = false,
  onClose,
  onSent,
}: EmailReplyDialogProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!message) {
      setTo("");
      setSubject("");
      setBody("");
      setError("");
      return;
    }
    setTo(extractAddress(message.from));
    setSubject(replySubject(message.subject));
    setBody(quotedBody(message));
    setError("");
  }, [open, message]);

  const onSubmit = async () => {
    if (disabled || accountId == null) return;
    const trimmedTo = to.trim();
    if (!trimmedTo) {
      setError(m.email_reply_to_required());
      return;
    }
    setSaving(true);
    setError("");
    try {
      await sendEmailMessage({
        account_id: accountId,
        to: trimmedTo,
        subject: subject.trim() || (message ? replySubject(message.subject) : ""),
        body,
      });
      onClose();
      onSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      className="max-w-lg"
    >
      <DialogHeader>
        <DialogTitle>{message ? m.email_reply() : m.email_compose()}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 py-2">
        <FormField label={m.email_reply_to()}>
          <Input value={to} onChange={(e) => setTo(e.target.value)} disabled={disabled || saving} />
        </FormField>
        <FormField label={m.email_reply_subject()}>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={disabled || saving}
          />
        </FormField>
        <FormField label={m.email_reply_body()}>
          <Textarea
            className="min-h-40"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={disabled || saving}
          />
        </FormField>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          {m.email_cancel()}
        </Button>
        <Button type="button" disabled={disabled || saving} onClick={() => void onSubmit()}>
          {saving ? <Spinner className="size-4" /> : m.email_send_action()}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
