import { afterEach, describe, expect, it, spyOn } from "bun:test";

import * as notificationMod from "@freeanima/habitat/capabilities/tools/notification";
import {
  notifySoftFailure,
  registerSoftFailureNotify,
  unregisterSoftFailureNotify,
} from "@freeanima/habitat/core/soft-failure";
import { deliverSoftFailureNotify } from "./soft-failure-notify.ts";

afterEach(() => {
  notificationMod.resetNotificationPortForTests();
  unregisterSoftFailureNotify();
});

describe("deliverSoftFailureNotify / notifySoftFailure", () => {
  it("notifies both recipients when no prior source_ref", async () => {
    const created: Array<{ recipient_kind: string; source_ref?: string | null; title: string }> =
      [];
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
    registerSoftFailureNotify(deliverSoftFailureNotify);

    const action = await notifySoftFailure({
      sourceRef: "test:soft:2026-07-28",
      title: "测试旁路失败",
      body: "详情",
      payload: { kind: "test_soft_failure" },
    });
    expect(action).toBe("notified");
    expect(created).toHaveLength(2);
    expect(created.every((c) => c.source_ref === "test:soft:2026-07-28")).toBe(true);
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
    registerSoftFailureNotify(deliverSoftFailureNotify);

    const action = await notifySoftFailure({
      sourceRef: "test:soft:2026-07-28",
      title: "测试旁路失败",
      body: "详情",
    });
    expect(action).toBe("deduped");
    expect(created).toHaveLength(0);
  });

  it("skips when notification port missing", async () => {
    spyOn(notificationMod, "getNotificationPort").mockReturnValue(null);
    registerSoftFailureNotify(deliverSoftFailureNotify);
    const action = await notifySoftFailure({
      sourceRef: "test:soft:2026-07-28",
      title: "x",
      body: "y",
    });
    expect(action).toBe("skipped");
  });

  it("skips when soft-failure notify not registered", async () => {
    const action = await notifySoftFailure({
      sourceRef: "test:soft:2026-07-28",
      title: "x",
      body: "y",
    });
    expect(action).toBe("skipped");
  });
});
