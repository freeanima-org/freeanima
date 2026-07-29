import { useMemo } from "react";
import type { DisplayItem } from "@freeanima/shared/rpc-contract/frames/display.ts";
import { Button, Spinner } from "@freeanima/ui-kit";
import { renderMarkdownHtml } from "@freeanima/ui-kit/lib/markdown.ts";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";
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

function AssistantMessageBubble({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdownHtml(content), [content]);
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
          {m.habitat_message_no_messages_on_page()}
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
            {m.habitat_common_pagination({
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
              {m.habitat_common_previous_page()}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={currentPage >= pageCount || loading}
              onClick={() => onPageChange(currentPage + 1)}
            >
              {m.habitat_common_next_page()}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
