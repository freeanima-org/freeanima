import { Button } from "@freeanima/frontend/ui-kit";
import { m } from "@freeanima/features/habitat/ui/habitat/lib/i18n.ts";

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
  );
}
