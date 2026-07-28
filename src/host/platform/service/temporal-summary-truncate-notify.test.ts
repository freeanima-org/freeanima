import { afterEach, describe, expect, it, spyOn } from "bun:test";

import * as notificationMod from "@freeanima/host/capabilities/tools/notification";
import { notifyTemporalSummarySystemTruncated } from "./temporal-summary-truncate-notify.ts";

afterEach(() => {
  notificationMod.resetNotificationPortForTests();
});

describe("notifyTemporalSummarySystemTruncated", () => {
  it("notifies both recipients when truncated and no prior source_ref", async () => {
    const created: Array<{ recipient_kind: string; source_ref?: string | null }> = [];
    spyOn(notificationMod, "getNotificationPort").mockReturnValue({
      getUserRecipient: () => ({ kind: "user" as const, id: "u1" }),
      getAgentRecipient: () => ({ kind: "agent" as const, id: "a1" }),
      existsBySourceRef: async () => false,
      create: async (input) => {
        created.push(input);
        return {} as never;
      },
      list: async () => [],
      markRead: async () => null,
      markReadBySourceRef: async () => 0,
    });

    const action = await notifyTemporalSummarySystemTruncated({
      maxChars: 1500,
      nowMs: Date.parse("2026-07-28T10:00:00.000Z"),
    });
    expect(action).toBe("notified");
    expect(created).toHaveLength(2);
    expect(
      created.every((c) => c.source_ref === "temporal_summary:system_truncated:2026-07-28"),
    ).toBe(true);
  });

  it("dedupes when both recipients already have source_ref", async () => {
    const created: unknown[] = [];
    spyOn(notificationMod, "getNotificationPort").mockReturnValue({
      getUserRecipient: () => ({ kind: "user" as const, id: "u1" }),
      getAgentRecipient: () => ({ kind: "agent" as const, id: "a1" }),
      existsBySourceRef: async () => true,
      create: async (input) => {
        created.push(input);
        return {} as never;
      },
      list: async () => [],
      markRead: async () => null,
      markReadBySourceRef: async () => 0,
    });

    const action = await notifyTemporalSummarySystemTruncated({
      maxChars: 1500,
      nowMs: Date.parse("2026-07-28T10:00:00.000Z"),
    });
    expect(action).toBe("deduped");
    expect(created).toHaveLength(0);
  });

  it("skips when notification port missing", async () => {
    spyOn(notificationMod, "getNotificationPort").mockReturnValue(null);
    const action = await notifyTemporalSummarySystemTruncated({ maxChars: 1500 });
    expect(action).toBe("skipped");
  });
});
