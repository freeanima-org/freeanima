import { marked } from "marked";
import { useMemo } from "react";
import type { DisplayItem } from "@freeanima/features/console/protocol/console-contract/api";
import { Button, Spinner } from "@freeanima/frontend/ui-kit";
import { m } from "@freeanima/features/console/ui/console/lib/i18n.ts";
import { ToolBlockBubble } from "./ToolBlockBubble.tsx";

type StoredMessagePanelProps = {
  items: DisplayItem[];
  total: number;
  currentPage: number;
  pageCount: number;
  pageSize: number;
  pageOffset: number;
  loading: boolean;
  onPageChange: (page: number) => void;
};

function renderMd(text: string) {
  if (!text) return "";
  try {
    return marked.parse(text, { breaks: true, gfm: true }) as string;
  } catch {
    return text;
  }
}

function AssistantMessageBubble({ content }: { content: string }) {
  const html = useMemo(() => renderMd(content), [content]);
  return <div className="md-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function StoredMessagePanel({
  items,
  total,
  currentPage,
  pageCount,
  pageSize,
  pageOffset,
  loading,
  onPageChange,
}: StoredMessagePanelProps) {
  return (
    <div className="space-y-3 py-3">
      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          {m.console_message_no_messages_on_page()}
        </div>
      ) : (
        items.map((item, i) => {
          const key = `${pageOffset}-${i}`;
          if (item.type === "message" && item.role === "user") {
            return (
              <div key={key} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
                  {item.content}
                </div>
              </div>
            );
          }
          if (item.type === "message" && item.role === "assistant") {
            return (
              <div key={key} className="flex justify-start">
                <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm">
                  <AssistantMessageBubble content={item.content} />
                </div>
              </div>
            );
          }
          if (item.type === "tool_block") {
            return (
              <div key={key} className="flex justify-start max-w-full">
                <ToolBlockBubble calls={item.calls} />
              </div>
            );
          }
          return null;
        })
      )}

      {total > pageSize ? (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border/50 text-xs">
          <span className="text-muted-foreground">
            {m.console_common_pagination({
              total: String(total),
              current: String(currentPage),
              pages: String(pageCount),
            })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={currentPage <= 1 || loading}
              onClick={() => onPageChange(currentPage - 1)}
            >
              {m.console_common_previous_page()}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={currentPage >= pageCount || loading}
              onClick={() => onPageChange(currentPage + 1)}
            >
              {m.console_common_next_page()}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
