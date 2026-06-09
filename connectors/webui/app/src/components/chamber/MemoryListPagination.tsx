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
  );
}
