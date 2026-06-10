import { m } from "@/lib/i18n.ts";

type MemoryListPaginationProps = {
  total: number;
  pageSize: number;
  currentPage: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
};

export function MemoryListPagination({
  total,
  pageSize,
  currentPage,
  loading = false,
  onPageChange,
}: MemoryListPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-base-300/50 text-xs">
      <span className="text-base-content/60">
        {m.webui_common_pagination({
          total: String(total),
          current: String(currentPage),
          pages: String(pageCount),
        })}
      </span>
      <div className="join">
        <button
          type="button"
          className="btn btn-xs join-item"
          disabled={currentPage <= 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
        >
          {m.webui_common_previous_page()}
        </button>
        <button
          type="button"
          className="btn btn-xs join-item"
          disabled={currentPage >= pageCount || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          {m.webui_common_next_page()}
        </button>
      </div>
    </div>
  );
}
