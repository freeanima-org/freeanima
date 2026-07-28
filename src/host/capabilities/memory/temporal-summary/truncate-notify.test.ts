import { describe, expect, it } from "bun:test";

import {
  TEMPORAL_SUMMARY_SYSTEM_TRUNCATED_SOURCE_PREFIX,
  temporalSummarySystemTruncatedSourceRef,
} from "./truncate-notify.ts";

describe("temporalSummarySystemTruncatedSourceRef", () => {
  it("uses CST date and stable prefix", () => {
    // 2026-07-28 10:00 UTC = 2026-07-28 18:00 CST
    const ref = temporalSummarySystemTruncatedSourceRef(Date.parse("2026-07-28T10:00:00.000Z"));
    expect(ref).toBe(`${TEMPORAL_SUMMARY_SYSTEM_TRUNCATED_SOURCE_PREFIX}:2026-07-28`);
  });

  it("rolls CST date near midnight UTC", () => {
    // 2026-07-27 17:00 UTC = 2026-07-28 01:00 CST
    const ref = temporalSummarySystemTruncatedSourceRef(Date.parse("2026-07-27T17:00:00.000Z"));
    expect(ref).toBe(`${TEMPORAL_SUMMARY_SYSTEM_TRUNCATED_SOURCE_PREFIX}:2026-07-28`);
  });
});
