import { useEffect, useId, useState, type ClipboardEvent } from "react";
import {
  Button,
  Checkbox,
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

import {
  listObjectFilesForAttach,
  sendEmailMessage,
  uploadEmailAttachment,
  type EmailMessageRow,
  type EmailObjectLibraryItem,
} from "../lib/api.ts";

const EMAIL_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 20;

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type PendingLocal = {
  kind: "local";
  key: string;
  file: File;
};

type PendingLibrary = {
  kind: "library";
  key: string;
  object_file_id: number;
  filename: string;
};

type PendingAttachment = PendingLocal | PendingLibrary;

type EmailReplyDialogProps = {
  open: boolean;
  message: EmailMessageRow | null;
  accountId: number | null;
  disabled?: boolean;
  onClose: () => void;
  onSent?: () => void;
};

function filesFromClipboard(e: ClipboardEvent): File[] {
  const out: File[] = [];
  const { clipboardData } = e;
  if (!clipboardData) return out;

  if (clipboardData.files?.length) {
    for (const file of Array.from(clipboardData.files)) {
      out.push(file);
    }
  }

  if (out.length === 0 && clipboardData.items?.length) {
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) out.push(file);
    }
  }

  return out;
}

export function EmailReplyDialog({
  open,
  message,
  accountId,
  disabled = false,
  onClose,
  onSent,
}: EmailReplyDialogProps) {
  const fileInputId = useId();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryItems, setLibraryItems] = useState<EmailObjectLibraryItem[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySelected, setLibrarySelected] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!open) return;
    setPending([]);
    setLibraryOpen(false);
    setLibrarySelected(new Set());
    setLibraryQuery("");
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

  function addLocalFiles(fileList: FileList | File[]) {
    const next: PendingLocal[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > EMAIL_ATTACHMENT_MAX_BYTES) {
        setError(
          m.email_attachment_too_large({
            name: file.name || "attachment",
            limit: String(EMAIL_ATTACHMENT_MAX_BYTES / (1024 * 1024)),
          }),
        );
        continue;
      }
      const name = file.name || `paste-${Date.now()}`;
      next.push({
        kind: "local",
        key: `local-${name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file: file.name ? file : new File([file], name, { type: file.type }),
      });
    }
    if (next.length === 0) return;
    setError("");
    setPending((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
  }

  function addLibraryItems(items: EmailObjectLibraryItem[]) {
    const existingIds = new Set(
      pending.filter((p): p is PendingLibrary => p.kind === "library").map((p) => p.object_file_id),
    );
    const next: PendingLibrary[] = [];
    for (const item of items) {
      if (existingIds.has(item.id)) continue;
      next.push({
        kind: "library",
        key: `lib-${item.id}`,
        object_file_id: item.id,
        filename: item.title,
      });
    }
    if (next.length === 0) return;
    setPending((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
  }

  async function openLibrary() {
    setLibraryOpen(true);
    setLibraryLoading(true);
    setError("");
    try {
      const q = libraryQuery.trim();
      const items = await listObjectFilesForAttach(q ? { query: q } : undefined);
      setLibraryItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLibraryOpen(false);
    } finally {
      setLibraryLoading(false);
    }
  }

  async function searchLibrary() {
    setLibraryLoading(true);
    try {
      const q = libraryQuery.trim();
      const items = await listObjectFilesForAttach(q ? { query: q } : undefined);
      setLibraryItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLibraryLoading(false);
    }
  }

  function confirmLibrarySelection() {
    const selected = libraryItems.filter((item) => librarySelected.has(item.id));
    addLibraryItems(selected);
    setLibrarySelected(new Set());
    setLibraryOpen(false);
  }

  function onPaste(e: ClipboardEvent) {
    const files = filesFromClipboard(e);
    if (files.length === 0) return;
    e.preventDefault();
    addLocalFiles(files);
  }

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
      const ids: number[] = [];
      for (const item of pending) {
        if (item.kind === "library") {
          ids.push(item.object_file_id);
          continue;
        }
        const uploaded = await uploadEmailAttachment(item.file);
        ids.push(uploaded.object_file_id);
      }
      await sendEmailMessage({
        account_id: accountId,
        to: trimmedTo,
        subject: subject.trim() || (message ? replySubject(message.subject) : ""),
        body,
        ...(ids.length > 0 ? { attachment_object_file_ids: ids } : {}),
      });
      onClose();
      onSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const atLimit = pending.length >= MAX_ATTACHMENTS;

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      className="max-w-lg"
    >
      <DialogHeader>
        <DialogTitle>{message ? m.email_reply() : m.email_compose()}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-3 py-2" onPaste={onPaste}>
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
            onPaste={onPaste}
          />
        </FormField>
        <FormField label={m.email_attachments()}>
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">{m.email_attach_paste_hint()}</p>
            <input
              id={fileInputId}
              type="file"
              multiple
              className="hidden"
              disabled={disabled || saving}
              onChange={(e) => {
                if (e.target.files?.length) addLocalFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                isDisabled={disabled || saving || atLimit}
                onClick={() => document.getElementById(fileInputId)?.click()}
              >
                {m.email_attach_files()}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                isDisabled={disabled || saving || atLimit}
                onClick={() => void openLibrary()}
              >
                {m.email_attach_from_library()}
              </Button>
            </div>
            {libraryOpen ? (
              <div className="border-border space-y-2 rounded-md border p-2">
                <div className="flex gap-1">
                  <Input
                    value={libraryQuery}
                    onChange={(e) => setLibraryQuery(e.target.value)}
                    placeholder={m.email_attach_library_search()}
                    disabled={libraryLoading || saving}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void searchLibrary();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isDisabled={libraryLoading || saving}
                    onClick={() => void searchLibrary()}
                  >
                    {m.email_attach_library_search_action()}
                  </Button>
                </div>
                {libraryLoading ? (
                  <div className="flex justify-center py-4">
                    <Spinner className="size-5" />
                  </div>
                ) : libraryItems.length === 0 ? (
                  <p className="text-muted-foreground text-xs">{m.email_attach_library_empty()}</p>
                ) : (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                    {libraryItems.map((item) => {
                      const checked = librarySelected.has(item.id);
                      return (
                        <li key={item.id}>
                          <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded px-1 py-0.5">
                            <Checkbox
                              isSelected={checked}
                              onChange={(next) => {
                                setLibrarySelected((prev) => {
                                  const copy = new Set(prev);
                                  if (next) copy.add(item.id);
                                  else copy.delete(item.id);
                                  return copy;
                                });
                              }}
                              isDisabled={saving}
                              aria-label={item.title}
                            />
                            <span className="min-w-0 flex-1 truncate" title={item.title}>
                              {item.title}
                              <span className="text-muted-foreground ml-2 text-xs">#{item.id}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    isDisabled={saving}
                    onClick={() => {
                      setLibraryOpen(false);
                      setLibrarySelected(new Set());
                    }}
                  >
                    {m.email_cancel()}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    isDisabled={saving || librarySelected.size === 0 || atLimit}
                    onClick={confirmLibrarySelection}
                  >
                    {m.email_attach_library_add()}
                  </Button>
                </div>
              </div>
            ) : null}
            {pending.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {pending.map((item) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {item.kind === "local" ? item.file.name : item.filename}
                      <span className="text-muted-foreground ml-2 text-xs">
                        {item.kind === "local"
                          ? formatSize(item.file.size)
                          : m.email_attach_from_library()}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      isDisabled={saving}
                      onClick={() => setPending((prev) => prev.filter((p) => p.key !== item.key))}
                    >
                      {m.email_attachment_remove()}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </FormField>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} isDisabled={saving}>
          {m.email_cancel()}
        </Button>
        <Button type="button" isDisabled={disabled || saving} onClick={() => void onSubmit()}>
          {saving ? <Spinner className="size-4" /> : m.email_send_action()}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
