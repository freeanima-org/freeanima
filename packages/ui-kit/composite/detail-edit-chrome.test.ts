import { describe, expect, test } from "bun:test";

import {
  DETAIL_EDIT_HISTORY_KEY,
  clearDetailEditChrome,
  enterDetailEditChrome,
  exitDetailEditChrome,
  historyStateHasDetailEdit,
} from "./detail-edit-chrome.ts";

describe("detail-edit-chrome", () => {
  test("DETAIL_EDIT_HISTORY_KEY 稳定", () => {
    expect(DETAIL_EDIT_HISTORY_KEY).toBe("freeanimaDetailEdit");
  });

  test("historyStateHasDetailEdit", () => {
    expect(historyStateHasDetailEdit(null)).toBe(false);
    expect(historyStateHasDetailEdit({})).toBe(false);
    expect(historyStateHasDetailEdit({ [DETAIL_EDIT_HISTORY_KEY]: true })).toBe(true);
  });

  test("enter：仅 compact 且有 item", () => {
    expect(enterDetailEditChrome("wide", true)).toBeNull();
    expect(enterDetailEditChrome("compact", false)).toBeNull();
    expect(enterDetailEditChrome("compact", true)).toEqual({
      detailEditMode: true,
      detailOpen: false,
      immersive: true,
    });
  });

  test("exit：reopenPeek=false 关 Sheet（产品路径退出编辑清详情回列表）", () => {
    expect(
      exitDetailEditChrome({
        layoutMode: "compact",
        hasItem: true,
        compactSheetEnabled: true,
        reopenPeek: false,
      }),
    ).toEqual({ detailEditMode: false, detailOpen: false, immersive: false });

    expect(
      exitDetailEditChrome({
        layoutMode: "compact",
        hasItem: true,
        compactSheetEnabled: true,
        reopenPeek: true,
      }),
    ).toEqual({ detailEditMode: false, detailOpen: true, immersive: false });
  });

  test("clear", () => {
    expect(clearDetailEditChrome()).toEqual({
      detailEditMode: false,
      detailOpen: false,
      immersive: false,
    });
  });
});
