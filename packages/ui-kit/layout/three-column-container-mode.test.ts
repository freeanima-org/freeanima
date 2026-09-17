import { describe, expect, it } from "bun:test";

import {
  clampListWidthForContainer,
  clampMiddleWidthForContainer,
  resolveThreeColumnMode,
  threeColumnModeForContainerWidth,
} from "./three-column-container-mode.ts";

describe("three-column-container-mode", () => {
  it("按容器宽度分档", () => {
    expect(threeColumnModeForContainerWidth(400)).toBe("compact");
    expect(threeColumnModeForContainerWidth(700)).toBe("medium");
    expect(threeColumnModeForContainerWidth(900)).toBe("wide");
  });

  it("未量到可靠宽度时回退视口档", () => {
    expect(resolveThreeColumnMode(0, "wide")).toBe("wide");
    expect(resolveThreeColumnMode(200, "medium")).toBe("medium");
  });

  it("compact 视口不受容器宽度影响", () => {
    expect(resolveThreeColumnMode(700, "compact")).toBe("compact");
    expect(resolveThreeColumnMode(900, "compact")).toBe("compact");
  });

  it("列宽不超过容器剩余空间", () => {
    const limits = { min: 180, max: 480 };
    expect(clampListWidthForContainer(400, 320, 900, limits)).toBe(352);
    expect(clampMiddleWidthForContainer(256, 500, 900, { min: 220, max: 640 })).toBe(416);
    expect(clampMiddleWidthForContainer(256, 500, 900, { min: 220, max: 640 }, false)).toBe(500);
  });
});
