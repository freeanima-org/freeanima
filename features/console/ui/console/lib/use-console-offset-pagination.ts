import { useCallback, useState } from "react";

/** Console 列表页通用 offset 分页状态 */
export function useConsoleOffsetPagination(pageSize: number) {
  const [offset, setOffset] = useState(0);
  const currentPage = Math.floor(offset / pageSize) + 1;

  const offsetForPage = useCallback((page: number) => (page - 1) * pageSize, [pageSize]);

  const goToPage = useCallback(
    (page: number) => {
      setOffset(offsetForPage(page));
    },
    [offsetForPage],
  );

  return {
    offset,
    setOffset,
    currentPage,
    goToPage,
    offsetForPage,
    pageSize,
  };
}
