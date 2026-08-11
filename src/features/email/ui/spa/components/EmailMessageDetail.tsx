import { Button, Spinner } from "@freeanima/ui-kit";
import { EntityIdLabel } from "@freeanima/ui-kit/composite";
import { m } from "@paraglide/messages";

import type { EmailMessageRow } from "../lib/api.ts";
import { buildEmailHtmlSrcDoc, looksLikeHtmlBody } from "../lib/email-html.ts";

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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
