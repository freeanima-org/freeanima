import { describe, expect, test } from "bun:test";

import { isPlainIsoDateString, reviveDates } from "./date-json.ts";

describe("isPlainIsoDateString", () => {
  test("accepts ISO strings", () => {
    expect(isPlainIsoDateString("2026-06-28T12:00:00.000Z")).toBe(true);
    expect(isPlainIsoDateString("2026-06-28T20:00:00+08:00")).toBe(true);
  });

  test("rejects non-dates", () => {
    expect(isPlainIsoDateString("hello")).toBe(false);
    expect(isPlainIsoDateString("2026-06-28")).toBe(false);
  });
});

describe("reviveDates", () => {
  test("revives known timestamp keys", () => {
    const input = {
      id: "x",
      created_at: "2026-06-28T12:00:00.000Z",
      nested: { updated_at: "2026-06-28T13:00:00.000Z" },
    };
    const out = reviveDates(input);
    expect(out.created_at).toBeInstanceOf(Date);
    expect(out.nested.updated_at).toBeInstanceOf(Date);
    expect(out.id).toBe("x");
  });

  test("does not revive arbitrary strings", () => {
    const input = { title: "2026-06-28T12:00:00.000Z" };
    const out = reviveDates(input);
    expect(out.title).toBe("2026-06-28T12:00:00.000Z");
  });

  test("revives arrays", () => {
    const input = [{ created_at: "2026-06-28T12:00:00.000Z" }];
    const out = reviveDates(input);
    expect(out[0]?.created_at).toBeInstanceOf(Date);
  });

  test("preserves existing Date instances", () => {
    const created = new Date("2026-06-28T12:00:00.000Z");
    const lastUsed = new Date("2026-06-28T13:00:00.000Z");
    const out = reviveDates({ created_at: created, last_used_at: lastUsed });
    expect(out.created_at).toBe(created);
    expect(out.last_used_at).toBe(lastUsed);
  });

  test("revives last_used_at strings", () => {
    const out = reviveDates({ last_used_at: "2026-06-28T12:00:00.000Z" });
    expect(out.last_used_at).toBeInstanceOf(Date);
  });
});
