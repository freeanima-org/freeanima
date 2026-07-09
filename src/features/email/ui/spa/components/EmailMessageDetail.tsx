import { Spinner } from "@freeanima/frontend/ui-kit";

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
        选择一封邮件阅读
      </div>
    );
  }

  return (
    <article className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
      <div className="text-muted-foreground mb-4 space-y-1">
        <div>发件人：{message.from}</div>
        <div>收件人：{message.to}</div>
        <div>时间：{formatWhen(message.sent_at)}</div>
      </div>
      <pre className="wrap-break-word whitespace-pre-wrap">{message.body}</pre>
    </article>
  );
}
