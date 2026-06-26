import { describe, expect, it } from "bun:test";

import { nullNotificationStore } from "./null-notification.ts";

describe("nullNotificationStore", () => {
  it("read operations throw database.url not configured", async () => {
    await expect(
      nullNotificationStore.list({
        recipient_kind: "user",
      }),
    ).rejects.toThrow(/NotificationStore not configured/);
    await expect(
      nullNotificationStore.count({
        recipient_kind: "user",
      }),
    ).rejects.toThrow(/NotificationStore not configured/);
  });

  it("write operations throw database.url not configured", async () => {
    await expect(
      nullNotificationStore.create({
        recipient_kind: "user",
        title: "t",
        body: "b",
      }),
    ).rejects.toThrow(/NotificationStore not configured/);
    await expect(nullNotificationStore.markRead("id")).rejects.toThrow(
      /NotificationStore not configured/,
    );
  });
});
