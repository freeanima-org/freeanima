import { describe, expect, it } from "bun:test";

import {
  formatMemoryReferenceMarker,
  formatResidentMemoryLine,
  memoryReferenceWeight,
  parseMemoryReferenceMarkers,
  MEMORY_REFERENCE_DECAY_DAYS,
} from "./markers.ts";

describe("memory-reference markers", () => {
  it("formatMemoryReferenceMarker produces fixed format", () => {
    expect(formatMemoryReferenceMarker(42)).toBe("[[anima:42]]");
    expect(formatMemoryReferenceMarker("101")).toBe("[[anima:101]]");
  });

  it("formatResidentMemoryLine includes ID and pin marker", () => {
    expect(formatResidentMemoryLine("content", 42, true)).toBe("- 📌 [[anima:42]] content");
    expect(formatResidentMemoryLine("content", 101, false)).toBe("- [[anima:101]] content");
  });

  it("parseMemoryReferenceMarkers parses and dedupes", () => {
    const text = "See [[anima:42]] and [[anima:101]]; duplicate [[anima:42]]";
    expect(parseMemoryReferenceMarkers(text)).toEqual([42, 101]);
  });

  it("parseMemoryReferenceMarkers ignores invalid markers", () => {
    expect(parseMemoryReferenceMarkers("[[invalid]] body")).toEqual([]);
    expect(parseMemoryReferenceMarkers("[[anima:0]] body")).toEqual([]);
    expect(parseMemoryReferenceMarkers("no markers")).toEqual([]);
  });

  it("memoryReferenceWeight is higher within 30 days", () => {
    const now = new Date("2026-06-09T12:00:00Z");
    const recent = new Date("2026-06-01T12:00:00Z");
    const stale = new Date(now.getTime() - (MEMORY_REFERENCE_DECAY_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(memoryReferenceWeight(recent, now)).toBe(2);
    expect(memoryReferenceWeight(stale, now)).toBe(1);
  });
});
