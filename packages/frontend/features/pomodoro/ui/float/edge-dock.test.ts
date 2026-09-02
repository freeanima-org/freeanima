import { describe, expect, test } from "bun:test";
import {
  collapsedSize,
  detectDockEdge,
  expandedSize,
  framesClose,
  progressRatio,
  snapCollapsedFrame,
  snapExpandedNearEdge,
  type RectPx,
} from "./edge-dock.ts";

const work: RectPx = { x: 0, y: 0, width: 1920, height: 1080 };

describe("edge-dock", () => {
  test("detectDockEdge picks nearest within threshold", () => {
    expect(detectDockEdge({ x: 10, y: 400, width: 220, height: 120 }, work, 24)).toBe("left");
    expect(detectDockEdge({ x: 1700, y: 400, width: 220, height: 120 }, work, 24)).toBe("right");
    expect(detectDockEdge({ x: 800, y: 5, width: 220, height: 120 }, work, 24)).toBe("top");
    expect(detectDockEdge({ x: 800, y: 960, width: 220, height: 120 }, work, 24)).toBe("bottom");
    expect(detectDockEdge({ x: 800, y: 400, width: 220, height: 120 }, work, 24)).toBeNull();
  });

  test("collapsedSize orientation", () => {
    expect(collapsedSize("left")).toEqual({ width: 8, height: 120 });
    expect(collapsedSize("top")).toEqual({ width: 120, height: 8 });
    expect(expandedSize()).toEqual({ width: 260, height: 220 });
  });

  test("snapCollapsedFrame pins to edge", () => {
    const left = snapCollapsedFrame("left", { x: 20, y: 400, width: 220, height: 156 }, work);
    expect(left.x).toBe(0);
    expect(left.width).toBe(8);
    expect(left.height).toBe(120);

    const right = snapCollapsedFrame("right", { x: 1600, y: 400, width: 220, height: 156 }, work);
    expect(right.x + right.width).toBe(1920);
  });

  test("snapExpandedNearEdge stays docked", () => {
    const collapsed = { x: 0, y: 500, width: 8, height: 120 };
    const expanded = snapExpandedNearEdge("left", collapsed, work);
    expect(expanded.x).toBe(0);
    expect(expanded.width).toBe(260);
    expect(expanded.height).toBe(220);
  });

  test("progressRatio", () => {
    expect(progressRatio(0, 1000)).toBe(1);
    expect(progressRatio(500, 1000)).toBe(0.5);
    expect(progressRatio(1000, 1000)).toBe(0);
    expect(progressRatio(100, 0)).toBe(0);
  });

  test("framesClose", () => {
    const a = { x: 0, y: 10, width: 8, height: 120 };
    expect(framesClose(a, { ...a, x: 1 })).toBe(true);
    expect(framesClose(a, { ...a, x: 3 })).toBe(false);
  });
});
