import { useEffect, useState } from "react";
import { Button, Spinner } from "@freeanima/ui-kit";
import { EntityIdLabel } from "@freeanima/ui-kit/composite";
import { m } from "@paraglide/messages";

import {
  downloadEmailAttachmentBytes,
  type EmailAttachmentRow,
  type EmailMessageRow,
} from "../lib/api.ts";
import { buildEmailHtmlSrcDoc, looksLikeHtmlBody } from "../lib/email-html.ts";

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(att: EmailAttachmentRow): boolean {
  return att.content_type.toLowerCase().startsWith("image/");
}

type EmailMessageDetailProps = {
  loading: boolean;
  message: EmailMessageRow | null;
  writesDisabled?: boolean;
  /** 发件箱不显示已读/未读操作 */
  showUnreadActions?: boolean;
  onReply?: () => void;
  onMarkUnread?: () => void;
  onMarkRead?: () => void;
  onCopyId?: () => void;
  onDelete?: () => void;
};

function EmailAttachmentList({ attachments }: { attachments: EmailAttachmentRow[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function withBlob(att: EmailAttachmentRow, action: "download" | "preview") {
    setBusyId(att.file_id);
    setError(null);
    try {
      const blob = await downloadEmailAttachmentBytes(att.object_file_id);
      const url = URL.createObjectURL(blob);
      if (action === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = att.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setPreviewName(att.filename);
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(m.email_attachment_download_failed({ detail }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="border-border mb-4 space-y-2 rounded-md border p-3">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {m.email_attachments()}
      </div>
      <ul className="space-y-2">
        {attachments.map((att) => (
          <li key={att.file_id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate" title={att.filename}>
              {att.filename}
              <span className="text-muted-foreground ml-2 text-xs">
                {formatSize(att.size)} · {att.content_type}
              </span>
            </span>
            <div className="flex gap-1">
              {isImageAttachment(att) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  isDisabled={busyId === att.file_id}
                  onClick={() => void withBlob(att, "preview")}
                >
                  {busyId === att.file_id ? (
                    <Spinner className="size-3" />
                  ) : (
                    m.email_attachment_preview()
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                isDisabled={busyId === att.file_id}
                onClick={() => void withBlob(att, "download")}
              >
                {busyId === att.file_id && !isImageAttachment(att) ? (
                  <Spinner className="size-3" />
                ) : (
                  m.email_attachment_download()
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {previewUrl ? (
        <div className="mt-2 space-y-1">
          <div className="text-muted-foreground text-xs">{previewName}</div>
          <img
            src={previewUrl}
            alt={previewName ?? m.email_attachment_preview()}
            className="border-border max-h-80 max-w-full rounded-md border object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

export function EmailMessageDetail({
  loading,
  message,
  writesDisabled = false,
  showUnreadActions = true,
  onReply,
  onMarkUnread,
  onMarkRead,
  onCopyId,
  onDelete,
}: EmailMessageDetailProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-sm">
        {m.habitat_email_select_message()}
      </div>
    );
  }

  const isHtml = message.content_type === "text/html" || looksLikeHtmlBody(message.body);
  const attachments = message.attachments ?? [];

  return (
    <article className="flex min-h-0 flex-1 flex-col overflow-hidden text-sm">
      <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <EntityIdLabel id={message.id} animaComponent="email_message" />
        <div className="ml-auto flex flex-wrap gap-1">
          {onReply ? (
            <Button type="button" size="sm" isDisabled={writesDisabled} onClick={onReply}>
              {m.email_reply()}
            </Button>
          ) : null}
          {showUnreadActions
            ? message.unread
              ? onMarkRead && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isDisabled={writesDisabled}
                    onClick={onMarkRead}
                  >
                    {m.email_mark_read()}
                  </Button>
                )
              : onMarkUnread && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isDisabled={writesDisabled}
                    onClick={onMarkUnread}
                  >
                    {m.email_mark_unread()}
                  </Button>
                )
            : null}
          {onCopyId ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCopyId}>
              {m.email_copy_id()}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              isDisabled={writesDisabled}
              onClick={onDelete}
            >
              {m.email_delete_message()}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="text-muted-foreground mb-4 space-y-1">
          <div>
            {m.habitat_email_from()} {message.from}
          </div>
          <div>
            {m.habitat_email_to()} {message.to}
          </div>
          <div>
            {m.habitat_email_date()} {formatWhen(message.sent_at)}
          </div>
        </div>
        {attachments.length > 0 ? <EmailAttachmentList attachments={attachments} /> : null}
        {isHtml && message.body ? (
          <iframe
            title={message.subject || m.habitat_email_no_subject()}
            className="border-border h-[min(70vh,48rem)] w-full rounded-md border bg-white"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={buildEmailHtmlSrcDoc(message.body)}
          />
        ) : (
          <pre className="wrap-break-word whitespace-pre-wrap">
            {message.body || m.habitat_email_no_body()}
          </pre>
        )}
      </div>
    </article>
  );
}
