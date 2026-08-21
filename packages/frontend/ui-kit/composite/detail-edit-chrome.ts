import { isRecord } from "@freeanima/shared/util";

import type { ThreeColumnLayoutMode } from "../layout/three-column-mode.ts";

/** history.state 标记：compact 详情全屏编辑页 */
export const DETAIL_EDIT_HISTORY_KEY = "freeanimaDetailEdit";

export type DetailEditChrome = {
  detailEditMode: boolean;
  detailOpen: boolean;
  immersive: boolean;
};

export function historyStateHasDetailEdit(state: unknown): boolean {
  return isRecord(state) && state[DETAIL_EDIT_HISTORY_KEY] === true;
}

/** 进入 compact 全屏编辑：关 peek、开 immersive */
export function enterDetailEditChrome(
  layoutMode: ThreeColumnLayoutMode,
  hasItem: boolean,
): DetailEditChrome | null {
  if (layoutMode !== "compact" || !hasItem) return null;
  return { detailEditMode: true, detailOpen: false, immersive: true };
}

/** 退出编辑：可选回到 peek */
export function exitDetailEditChrome(opts: {
  layoutMode: ThreeColumnLayoutMode;
  hasItem: boolean;
  compactSheetEnabled: boolean;
  reopenPeek: boolean;
}): DetailEditChrome {
  const reopen =
    opts.reopenPeek && opts.hasItem && opts.layoutMode === "compact" && opts.compactSheetEnabled;
  return { detailEditMode: false, detailOpen: reopen, immersive: false };
}

export function clearDetailEditChrome(): DetailEditChrome {
  return { detailEditMode: false, detailOpen: false, immersive: false };
}
