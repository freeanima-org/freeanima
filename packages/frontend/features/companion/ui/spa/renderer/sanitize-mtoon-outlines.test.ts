import { describe, expect, test } from "bun:test";
import { sanitizeMtoonOutlinesForOrtho } from "./sanitize-mtoon-outlines.ts";

function fakeRoot(materials: Array<{ isMToonMaterial?: boolean; outlineWidthMode?: string }>) {
  return {
    traverse(cb: (obj: { material?: unknown }) => void) {
      for (const material of materials) {
        cb({ material });
      }
    },
  };
}

describe("sanitizeMtoonOutlinesForOrtho", () => {
  test("将 screenCoordinates 改为 none", () => {
    const screen = { isMToonMaterial: true, outlineWidthMode: "screenCoordinates" };
    const world = { isMToonMaterial: true, outlineWidthMode: "worldCoordinates" };
    const none = { isMToonMaterial: true, outlineWidthMode: "none" };
    const other = { isMToonMaterial: false, outlineWidthMode: "screenCoordinates" };

    const n = sanitizeMtoonOutlinesForOrtho(fakeRoot([screen, world, none, other]));
    expect(n).toBe(1);
    expect(screen.outlineWidthMode).toBe("none");
    expect(world.outlineWidthMode).toBe("worldCoordinates");
    expect(none.outlineWidthMode).toBe("none");
    expect(other.outlineWidthMode).toBe("screenCoordinates");
  });

  test("支持 material 数组", () => {
    const a = { isMToonMaterial: true, outlineWidthMode: "screenCoordinates" };
    const b = { isMToonMaterial: true, outlineWidthMode: "screenCoordinates" };
    const root = {
      traverse(cb: (obj: { material?: unknown }) => void) {
        cb({ material: [a, b] });
      },
    };
    expect(sanitizeMtoonOutlinesForOrtho(root)).toBe(2);
    expect(a.outlineWidthMode).toBe("none");
    expect(b.outlineWidthMode).toBe("none");
  });
});
