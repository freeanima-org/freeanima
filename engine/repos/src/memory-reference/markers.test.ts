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
    expect(formatMemoryReferenceMarker("f-000001-abcd")).toBe("[memory #f-000001-abcd]");
  });

  it("formatResidentMemoryLine includes ID and pin marker", () => {
    expect(formatResidentMemoryLine("content", "f-000001-abcd", true)).toBe(
      "- 📌 [memory #f-000001-abcd] content",
    );
    expect(formatResidentMemoryLine("content", "f-000002-ef01", false)).toBe(
      "- [memory #f-000002-ef01] content",
    );
  });

  it("parseMemoryReferenceMarkers parses and dedupes", () => {
    const text =
      "See [memory #f-000001-abcd] and [memory #F-000002-EF01]; duplicate [memory #f-000001-abcd]";
    expect(parseMemoryReferenceMarkers(text)).toEqual(["f-000001-abcd", "f-000002-ef01"]);
  });

  it("parseMemoryReferenceMarkers ignores invalid markers", () => {
    expect(parseMemoryReferenceMarkers("[memory #invalid] body")).toEqual([]);
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
