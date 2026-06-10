import { describe, expect, it } from "bun:test";

import {
  formatMemoryReferenceMarker,
  formatResidentMemoryLine,
  memoryReferenceWeight,
  parseMemoryReferenceMarkers,
  MEMORY_REFERENCE_DECAY_DAYS,
} from "./markers.ts";

describe("memory-reference markers", () => {
  it("formatMemoryReferenceMarker 生成固定格式", () => {
    expect(formatMemoryReferenceMarker("f-000001-abcd")).toBe("[记忆 #f-000001-abcd]");
  });

  it("formatResidentMemoryLine 含 ID 与置顶标记", () => {
    expect(formatResidentMemoryLine("内容", "f-000001-abcd", true)).toBe(
      "- 📌 [记忆 #f-000001-abcd] 内容",
    );
    expect(formatResidentMemoryLine("内容", "f-000002-ef01", false)).toBe(
      "- [记忆 #f-000002-ef01] 内容",
    );
  });

  it("parseMemoryReferenceMarkers 解析并去重", () => {
    const text = "参考 [记忆 #f-000001-abcd] 与 [记忆 #F-000002-EF01]，重复 [记忆 #f-000001-abcd]";
    expect(parseMemoryReferenceMarkers(text)).toEqual(["f-000001-abcd", "f-000002-ef01"]);
  });

  it("parseMemoryReferenceMarkers 忽略非法标记", () => {
    expect(parseMemoryReferenceMarkers("[记忆 #invalid] 正文")).toEqual([]);
    expect(parseMemoryReferenceMarkers("无标记")).toEqual([]);
  });

  it("memoryReferenceWeight 30 天内权重更高", () => {
    const now = new Date("2026-06-09T12:00:00Z");
    const recent = new Date("2026-06-01T12:00:00Z");
    const stale = new Date(now.getTime() - (MEMORY_REFERENCE_DECAY_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(memoryReferenceWeight(recent, now)).toBe(2);
    expect(memoryReferenceWeight(stale, now)).toBe(1);
  });
});
