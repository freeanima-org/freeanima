import { describe, expect, test } from "bun:test";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatConversationIdDateTime,
} from "./format-datetime.ts";

describe("format-datetime", () => {
  test("formatDisplayDateTime from ISO", () => {
    expect(formatDisplayDateTime("2024-01-01T00:00:00.000Z")).toBe("2024/01/01 08:00");
  });

  test("formatDisplayDate from YYYY-MM-DD", () => {
    expect(formatDisplayDate("2026-06-15")).toBe("2026/06/15");
  });

  test("null returns em dash", () => {
    expect(formatDisplayDateTime(null)).toBe("—");
  });

  test("formatConversationIdDateTime", () => {
    expect(formatConversationIdDateTime("20260615_123456_abc")).toBe("2026/06/15 12:34");
    expect(formatConversationIdDateTime("20260615_123456_abc", { seconds: true })).toBe(
      "2026/06/15 12:34:56",
    );
  });
});
