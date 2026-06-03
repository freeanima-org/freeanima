import { marked } from "marked";
import type { DisplayItem } from "@freeanima/legacy-api";
import { ToolBlockBubble } from "./ToolBlockBubble";

type SessionMessagePanelProps = {
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

export function SessionMessagePanel({
  items,
  total,
  currentPage,
  pageCount,
  pageSize,
  pageOffset,
  loading,
  onPageChange,
}: SessionMessagePanelProps) {
  return (
    <div className="space-y-3 py-3">
      {loading ? (
        <div className="flex justify-center py-6">
          <span className="loading loading-dots loading-sm" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-base-content/50 text-center py-4">此页无消息</div>
      ) : (
        items.map((item, i) => {
          const key = `${pageOffset}-${i}`;
          if (item.type === "message" && item.role === "user") {
            return (
              <div key={key} className="chat chat-end">
                <div className="chat-bubble chat-bubble-primary whitespace-pre-wrap text-sm">
                  {item.content}
                </div>
              </div>
            );
          }
          if (item.type === "message" && item.role === "assistant") {
            return (
              <div key={key} className="chat chat-start">
                <div className="chat-bubble text-sm">
                  <div
                    className="md-content"
                    dangerouslySetInnerHTML={{ __html: renderMd(item.content) }}
                  />
                </div>
              </div>
            );
          }
          if (item.type === "tool_block") {
            return (
              <div key={key} className="chat chat-start max-w-full">
                <ToolBlockBubble calls={item.calls} />
              </div>
            );
          }
          return null;
        })
      )}

      {total > pageSize ? (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-base-300/50 text-xs">
          <span className="text-base-content/60">
            共 {total} 条 · 第 {currentPage} / {pageCount} 页
          </span>
          <div className="join">
            <button
              type="button"
              className="btn btn-xs join-item"
              disabled={currentPage <= 1 || loading}
              onClick={() => onPageChange(currentPage - 1)}
            >
              上一页
            </button>
            <button
              type="button"
              className="btn btn-xs join-item"
              disabled={currentPage >= pageCount || loading}
              onClick={() => onPageChange(currentPage + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
