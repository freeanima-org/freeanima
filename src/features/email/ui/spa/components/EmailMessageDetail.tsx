import { Spinner } from "@freeanima/frontend/ui-kit";
import { m } from "@paraglide/messages";

import type { EmailMessageRow } from "../lib/api.ts";

function formatWhen(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type EmailMessageDetailProps = {
  loading: boolean;
  message: EmailMessageRow | null;
};

export function EmailMessageDetail({ loading, message }: EmailMessageDetailProps) {
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

  return (
    <article className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
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
      <pre className="wrap-break-word whitespace-pre-wrap">
        {message.body || m.habitat_email_no_body()}
      </pre>
    </article>
  );
}
