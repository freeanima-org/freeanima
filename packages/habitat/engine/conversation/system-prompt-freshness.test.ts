import { describe, expect, test } from "bun:test";

import { CST_OFFSET_MS } from "@freeanima/habitat/core/util";

import { isSystemPromptStale, lastSystemPromptBoundaryMs } from "./system-prompt-freshness.ts";

/** Build UTC epoch ms for a CST wall-clock instant */
function cstInstantMs(isoWithoutOffset: string): number {
  return Date.parse(`${isoWithoutOffset}+08:00`);
}

describe("lastSystemPromptBoundaryMs", () => {
  test("before CST 02:00 uses previous day 02:00", () => {
    const now = cstInstantMs("2026-07-14T01:59:00.000");
    const boundary = lastSystemPromptBoundaryMs(now);
    expect(boundary).toBe(cstInstantMs("2026-07-13T02:00:00.000"));
  });

  test("exactly CST 02:00 uses that boundary", () => {
    const now = cstInstantMs("2026-07-14T02:00:00.000");
    expect(lastSystemPromptBoundaryMs(now)).toBe(now);
  });

  test("after CST 02:00 uses today's 02:00", () => {
    const now = cstInstantMs("2026-07-14T02:01:00.000");
    expect(lastSystemPromptBoundaryMs(now)).toBe(cstInstantMs("2026-07-14T02:00:00.000"));
  });

  test("matches CST_OFFSET_MS geometry", () => {
    const now = Date.UTC(2026, 6, 14, 0, 0, 0); // 08:00 CST July 14
    // July 14 00:00 UTC = July 14 08:00 CST → boundary July 14 02:00 CST
    const expected = Date.UTC(2026, 6, 14, 2, 0, 0) - CST_OFFSET_MS;
    expect(lastSystemPromptBoundaryMs(now)).toBe(expected);
  });
});

describe("isSystemPromptStale", () => {
  test("null / empty / invalid built_at is stale", () => {
    const now = cstInstantMs("2026-07-14T15:00:00.000");
    expect(isSystemPromptStale(null, now)).toBe(true);
    expect(isSystemPromptStale(undefined, now)).toBe(true);
    expect(isSystemPromptStale("", now)).toBe(true);
    expect(isSystemPromptStale("not-a-date", now)).toBe(true);
  });

  test("same day-period after 02:00 is fresh", () => {
    const built = cstInstantMs("2026-07-14T15:00:00.000");
    const now = cstInstantMs("2026-07-14T23:00:00.000");
    expect(isSystemPromptStale(new Date(built).toISOString(), now)).toBe(false);
  });

  test("before next 02:00 still fresh across midnight", () => {
    const built = cstInstantMs("2026-07-14T15:00:00.000");
    const now = cstInstantMs("2026-07-15T01:00:00.000");
    expect(isSystemPromptStale(new Date(built).toISOString(), now)).toBe(false);
  });

  test("after next CST 02:00 is stale", () => {
    const built = cstInstantMs("2026-07-14T15:00:00.000");
    const now = cstInstantMs("2026-07-15T02:01:00.000");
    expect(isSystemPromptStale(new Date(built).toISOString(), now)).toBe(true);
  });

  test("built exactly at boundary is fresh", () => {
    const boundary = cstInstantMs("2026-07-15T02:00:00.000");
    expect(isSystemPromptStale(new Date(boundary).toISOString(), boundary)).toBe(false);
  });
});
