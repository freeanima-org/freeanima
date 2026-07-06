import { useCallback, useState } from "react";

import {
  adjustColumnSplit,
  type ColumnSplitDefaults,
  type ColumnSplitLimits,
  DEFAULT_COLUMN_SPLIT_LIMITS,
  resolveColumnSplits,
  writeColumnSplits,
  type ColumnSplits,
} from "./column-split.ts";

export type UseColumnSplitsOptions = {
  storageKey: string;
  defaults: ColumnSplitDefaults;
  limits?: ColumnSplitLimits;
  enabled: boolean;
};

function currentSplits(prev: ColumnSplits, defaults: ColumnSplitDefaults): ColumnSplits {
  const list = prev.list ?? defaults.list;
  if (defaults.middle == null) return { list };
  return { list, middle: prev.middle ?? defaults.middle };
}

export function useColumnSplits({
  storageKey,
  defaults,
  limits = DEFAULT_COLUMN_SPLIT_LIMITS,
  enabled,
}: UseColumnSplitsOptions) {
  const [splits, setSplits] = useState<ColumnSplits>(() =>
    enabled ? resolveColumnSplits(storageKey, defaults, limits) : { list: defaults.list },
  );

  const listWidth = enabled ? (splits.list ?? defaults.list) : defaults.list;
  const middleWidth =
    enabled && defaults.middle != null ? (splits.middle ?? defaults.middle) : defaults.middle;

  const resizeList = useCallback(
    (delta: number) => {
      if (!enabled) return;
      setSplits((prev) => {
        const next = adjustColumnSplit(
          currentSplits(prev, defaults),
          "list",
          delta,
          defaults,
          limits,
        );
        writeColumnSplits(storageKey, next);
        return next;
      });
    },
    [enabled, storageKey, defaults, limits],
  );

  const resizeMiddle = useCallback(
    (delta: number) => {
      if (!enabled || defaults.middle == null) return;
      setSplits((prev) => {
        const next = adjustColumnSplit(
          currentSplits(prev, defaults),
          "middle",
          delta,
          defaults,
          limits,
        );
        writeColumnSplits(storageKey, next);
        return next;
      });
    },
    [enabled, storageKey, defaults, limits],
  );

  return {
    listWidth,
    middleWidth,
    resizeList,
    resizeMiddle,
  };
}
