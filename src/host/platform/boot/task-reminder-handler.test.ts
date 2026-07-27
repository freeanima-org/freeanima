import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { bindResolvedWorldContext } from "@freeanima/host/core/config/world-context";
import * as entityMod from "@freeanima/host/core/db/pg/entity";
import * as notificationMod from "@freeanima/host/capabilities/tools/notification";
import {
  recipientForTaskWorld,
  runTaskReminderScan,
  shouldSendTaskReminder,
  taskReminderSourceRef,
  triggerMs,
} from "./task-reminder-handler.ts";

bindResolvedWorldContext({
  user_world_id: 10,
  agent_world_id: 20,
  user_subject_id: 1,
  agent_subject_id: 2,
});

afterEach(() => {
  mock.restore();
});

describe("triggerMs", () => {
  it("prefers remind_at over due_at", () => {
    const remind = "2026-06-28T08:00:00.000Z";
    const due = "2026-06-28T18:00:00.000Z";
    expect(triggerMs({ remind_at: remind, due_at: due })).toBe(Date.parse(remind));
  });

  it("falls back to due_at when remind_at absent", () => {
    const due = "2026-06-28T18:00:00.000Z";
    expect(triggerMs({ due_at: due })).toBe(Date.parse(due));
  });

  it("returns null when neither set", () => {
    expect(triggerMs({})).toBeNull();
  });
});

describe("shouldSendTaskReminder", () => {
  const due = "2026-06-28T10:00:00.000Z";
  const at = Date.parse(due);

  it("sends when trigger passed and never notified", () => {
    expect(shouldSendTaskReminder({ due_at: due }, at + 60_000)).toBe(true);
  });

  it("skips when trigger is in the future", () => {
    expect(shouldSendTaskReminder({ due_at: due }, at - 1)).toBe(false);
  });

  it("skips when last_notified_at covers trigger", () => {
    expect(
      shouldSendTaskReminder(
        { due_at: due, last_notified_at: "2026-06-28T10:01:00.000Z" },
        at + 60_000,
      ),
    ).toBe(false);
  });

  it("sends again when due_at moved later after notify", () => {
    const laterDue = "2026-06-28T12:00:00.000Z";
    expect(
      shouldSendTaskReminder(
        { due_at: laterDue, last_notified_at: "2026-06-28T10:01:00.000Z" },
        Date.parse(laterDue) + 1,
      ),
    ).toBe(true);
  });
});

describe("taskReminderSourceRef", () => {
  it("includes trigger iso", () => {
    const ms = Date.parse("2026-06-28T10:00:00.000Z");
    expect(taskReminderSourceRef(42, ms)).toBe("task_item:42:trigger:2026-06-28T10:00:00.000Z");
  });
});

describe("recipientForTaskWorld", () => {
  const port = {
    getUserRecipient: () => ({ kind: "user" as const, id: "1" }),
    getAgentRecipient: () => ({ kind: "agent" as const, id: "2" }),
  };

  it("maps user and agent worlds", () => {
    expect(recipientForTaskWorld(10, port)).toEqual({ kind: "user", id: "1" });
    expect(recipientForTaskWorld(20, port)).toEqual({ kind: "agent", id: "2" });
  });

  it("returns null for unknown world", () => {
    expect(recipientForTaskWorld(99, port)).toBeNull();
  });
});

describe("runTaskReminderScan", () => {
  it("searchEntities 使用 global + user/agent world 白名单", async () => {
    const searchSpy = spyOn(entityMod, "searchEntities").mockResolvedValue({
      query: null,
      limit: 500,
      offset: 0,
      count: 0,
      results: [],
    });
    spyOn(notificationMod, "getNotificationPort").mockReturnValue({
      getUserRecipient: () => ({ kind: "user" as const, id: "1" }),
      getAgentRecipient: () => ({ kind: "agent" as const, id: "2" }),
      create: async () => ({ id: "n1" }),
    } as never);

    const out = JSON.parse(await runTaskReminderScan()) as { ok: boolean; sent: number };
    expect(out.ok).toBe(true);
    expect(out.sent).toBe(0);
    expect(searchSpy).toHaveBeenCalledTimes(1);
    const arg = searchSpy.mock.calls[0]?.[0] as {
      global?: boolean;
      accessible_world_ids?: number[];
    };
    expect(arg.global).toBe(true);
    expect(arg.accessible_world_ids).toEqual([10, 20]);
  });
});
