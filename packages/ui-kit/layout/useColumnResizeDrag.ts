import { useCallback, useEffect, useRef, useState } from "react";

import {
  adjustColumnSplit,
  type ColumnSplitDefaults,
  type ColumnSplitLimits,
  DEFAULT_COLUMN_SPLIT_LIMITS,
  resolveColumnSplits,
  writeColumnSplits,
  type ColumnSplits,
} from "./column-split.ts";
import {
  clampListWidthForContainer,
  clampMiddleWidthForContainer,
} from "./three-column-container-mode.ts";

export type UseColumnResizeDragOptions = {
  storageKey: string;
  defaults: ColumnSplitDefaults;
  limits?: ColumnSplitLimits;
  enabled: boolean;
  containerWidth: number;
  /** 清单列是否在三栏 flex 行内（medium 时为 drawer，不参与行内 clamp） */
  listInRow?: boolean;
};

function toDisplayWidths(
  splits: ColumnSplits,
  defaults: ColumnSplitDefaults,
): { list: number; middle: number | undefined } {
  return {
    list: splits.list ?? defaults.list,
    middle: defaults.middle != null ? (splits.middle ?? defaults.middle) : undefined,
  };
}

export function useColumnResizeDrag({
  storageKey,
  defaults,
  limits = DEFAULT_COLUMN_SPLIT_LIMITS,
  enabled,
  containerWidth,
  listInRow = true,
}: UseColumnResizeDragOptions) {
  const [splits, setSplits] = useState<ColumnSplits>(() =>
    enabled ? resolveColumnSplits(storageKey, defaults, limits) : { list: defaults.list },
  );

  const splitsRef = useRef(splits);
  splitsRef.current = splits;

  useEffect(() => {
    if (!enabled) return;
    const resolved = resolveColumnSplits(storageKey, defaults, limits);
    splitsRef.current = resolved;
    setSplits(resolved);
  }, [enabled, storageKey, defaults.list, defaults.middle, limits]);

  const display = toDisplayWidths(splits, defaults);

  const commit = useCallback(
    (next: ColumnSplits) => {
      if (!enabled) return;
      splitsRef.current = next;
      setSplits(next);
      writeColumnSplits(storageKey, next);
    },
    [enabled, storageKey],
  );

  const resizeList = useCallback(
    (delta: number) => {
      if (!enabled) return;
      const current = toDisplayWidths(splitsRef.current, defaults);
      const middle = current.middle ?? defaults.middle ?? 0;
      const splitCurrent: ColumnSplits = { list: current.list };
      if (current.middle != null) splitCurrent.middle = current.middle;
      const raw = adjustColumnSplit(splitCurrent, "list", delta, defaults, limits);
      const list = clampListWidthForContainer(
        raw.list ?? current.list,
        middle,
        containerWidth,
        limits.list,
      );
      const next: ColumnSplits = { list };
      if (current.middle != null) next.middle = current.middle;
      commit(next);
    },
    [enabled, defaults, limits, containerWidth, commit],
  );

  const resizeMiddle = useCallback(
    (delta: number) => {
      if (!enabled || defaults.middle == null) return;
      const current = toDisplayWidths(splitsRef.current, defaults);
      const middle = current.middle ?? defaults.middle;
      const raw = adjustColumnSplit(
        { list: current.list, middle },
        "middle",
        delta,
        defaults,
        limits,
      );
      const nextMiddle = clampMiddleWidthForContainer(
        current.list,
        raw.middle ?? middle,
        containerWidth,
        limits.middle,
        listInRow,
      );
      commit({ list: current.list, middle: nextMiddle });
    },
    [enabled, defaults, limits, containerWidth, listInRow, commit],
  );

  return {
    listWidth: display.list,
    middleWidth: display.middle,
    resizeList,
    resizeMiddle,
  };
}
