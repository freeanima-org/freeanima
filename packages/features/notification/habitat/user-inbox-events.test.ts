import { afterEach, describe, expect, test } from "bun:test";

import {
  emitUserNotificationCreated,
  resetUserNotificationWatchersForTest,
  watchUserNotificationCreated,
} from "./user-inbox-events.ts";

describe("user-inbox-events", () => {
  afterEach(() => {
    resetUserNotificationWatchersForTest();
  });

  test("emit 通知 watchers", () => {
    const seen: string[] = [];
    const off = watchUserNotificationCreated((p) => {
      seen.push(p.id);
    });
    emitUserNotificationCreated({
      id: "n1",
      title: "t",
      body: "b",
      created_at: new Date().toISOString(),
    });
    expect(seen).toEqual(["n1"]);
    off();
    emitUserNotificationCreated({
      id: "n2",
      title: "t",
      body: "b",
      created_at: new Date().toISOString(),
    });
    expect(seen).toEqual(["n1"]);
  });
});
