import { describe, expect, test } from "bun:test";

import { parseReminders, parseTagIds, parseTagTitles } from "./task-tool-helpers.ts";

describe("parseTagIds", () => {
  test("undefined when omitted", () => {
    expect(parseTagIds(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseTagIds(null)).toEqual({ ok: true, value: undefined });
  });

  test("accepts positive integers", () => {
    expect(parseTagIds([1, 2])).toEqual({ ok: true, value: [1, 2] });
    expect(parseTagIds(["3"])).toEqual({ ok: true, value: [3] });
  });

  test("rejects non-array and non-integer elements", () => {
    expect(parseTagIds("bug").ok).toBe(false);
    expect(parseTagIds(["bug"]).ok).toBe(false);
    expect(parseTagIds([1.5]).ok).toBe(false);
    expect(parseTagIds([0]).ok).toBe(false);
  });
});

describe("parseTagTitles", () => {
  test("undefined when omitted", () => {
    expect(parseTagTitles(undefined)).toEqual({ ok: true, value: undefined });
  });

  test("trims and drops empties", () => {
    expect(parseTagTitles([" bug ", "", "work"])).toEqual({
      ok: true,
      value: ["bug", "work"],
    });
  });

  test("rejects non-array", () => {
    expect(parseTagTitles("bug").ok).toBe(false);
  });
});

describe("parseReminders", () => {
  test("undefined when omitted", () => {
    expect(parseReminders(undefined)).toEqual({ ok: true, value: undefined });
  });

  test("empty array when null", () => {
    expect(parseReminders(null)).toEqual({ ok: true, value: [] });
  });

  test("accepts at + optional anchor", () => {
    expect(parseReminders([{ at: "2026-08-11T10:00:00+08:00", anchor: "start" }])).toEqual({
      ok: true,
      value: [{ at: "2026-08-11T10:00:00+08:00", anchor: "start" }],
    });
  });

  test("rejects invalid anchor", () => {
    expect(parseReminders([{ at: "x", anchor: "bogus" }]).ok).toBe(false);
  });
});
