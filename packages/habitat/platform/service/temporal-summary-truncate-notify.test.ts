import { afterEach, describe, expect, it, spyOn } from "bun:test";

import * as notificationMod from "@freeanima/habitat/capabilities/tools/notification";
import {
  registerSoftFailureNotify,
  unregisterSoftFailureNotify,
} from "@freeanima/habitat/core/soft-failure";
import { deliverSoftFailureNotify } from "./soft-failure-notify.ts";
import { notifyTemporalSummarySystemTruncated } from "./temporal-summary-truncate-notify.ts";

afterEach(() => {
  notificationMod.resetNotificationPortForTests();
  unregisterSoftFailureNotify();
});

function withNotificationPort(
  port: NonNullable<ReturnType<typeof notificationMod.getNotificationPort>>,
  run: () => Promise<void>,
): Promise<void> {
  const spy = spyOn(notificationMod, "getNotificationPort").mockReturnValue(port);
  return run().finally(() => {
    spy.mockRestore();
  });
}

describe("notifyTemporalSummarySystemTruncated", () => {
  it("notifies both recipients when truncated and no prior source_ref", async () => {
    const created: Array<{ recipient_kind: string; source_ref?: string | null }> = [];
    await withNotificationPort(
      {
        getUserRecipient: () => ({ kind: "user" as const, id: 1 }),
        getAgentRecipient: () => ({ kind: "agent" as const, id: 2 }),
        existsBySourceRef: async () => false,
        create: async (input) => {
          created.push(input);
          return {} as never;
        },
        list: async () => [],
        markRead: async () => null,
        markReadBySourceRef: async () => 0,
      },
      async () => {
        registerSoftFailureNotify(deliverSoftFailureNotify);
        const action = await notifyTemporalSummarySystemTruncated({
          maxChars: 1500,
          nowMs: Date.parse("2026-07-28T10:00:00.000Z"),
        });
        expect(action).toBe("notified");
        expect(created).toHaveLength(2);
        expect(
          created.every((c) => c.source_ref === "temporal_summary:system_truncated:2026-07-28"),
        ).toBe(true);
      },
    );
  });

  it("dedupes when both recipients already have source_ref", async () => {
    const created: unknown[] = [];
    await withNotificationPort(
      {
        getUserRecipient: () => ({ kind: "user" as const, id: 1 }),
        getAgentRecipient: () => ({ kind: "agent" as const, id: 2 }),
        existsBySourceRef: async () => true,
        create: async (input) => {
          created.push(input);
          return {} as never;
        },
        list: async () => [],
        markRead: async () => null,
        markReadBySourceRef: async () => 0,
      },
      async () => {
        registerSoftFailureNotify(deliverSoftFailureNotify);
        const action = await notifyTemporalSummarySystemTruncated({
          maxChars: 1500,
          nowMs: Date.parse("2026-07-28T10:00:00.000Z"),
        });
        expect(action).toBe("deduped");
        expect(created).toHaveLength(0);
      },
    );
  });

  it("skips when soft-failure notify not registered", async () => {
    const action = await notifyTemporalSummarySystemTruncated({ maxChars: 1500 });
    expect(action).toBe("skipped");
  });
});
