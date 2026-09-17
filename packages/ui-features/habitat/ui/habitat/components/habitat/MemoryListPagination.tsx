import { Button } from "@freeanima/ui-kit";

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
    <div className="flex items-center justify-between gap-2 pt-2 border-t border/50 text-xs">
      <span className="text-muted-foreground">
        {`共 ${String(total)} 条 · 第 ${String(currentPage)} / ${String(pageCount)} 页`}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          isDisabled={currentPage <= 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
        >
          {"上一页"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          isDisabled={currentPage >= pageCount || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          {"下一页"}
        </Button>
      </div>
    </div>
  );
}
