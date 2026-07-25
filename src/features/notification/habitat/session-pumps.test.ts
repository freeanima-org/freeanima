import { afterEach, describe, expect, test } from "bun:test";

import {
  bindNotificationSessionPumps,
  notificationSessionPumps,
  setNotificationSessionPumpsForTest,
} from "./session-pumps.ts";
import { pumpUserNotificationInbox } from "./stream.ts";
import {
  emitUserNotificationCreated,
  resetUserNotificationWatchersForTest,
} from "./user-inbox-events.ts";

describe("notification session-pumps", () => {
  afterEach(() => {
    setNotificationSessionPumpsForTest(null);
    resetUserNotificationWatchersForTest();
  });

  test("未 bind 时 notificationSessionPumps 抛错", () => {
    expect(() => notificationSessionPumps()).toThrow(/not initialized/);
  });

  test("bind 后与 WS 会话 Map 共享；abort 后可重建 pump 并再次推送", async () => {
    const events1: Array<{ method: string; id: string }> = [];
    const events2: Array<{ method: string; id: string }> = [];

    const map1 = new Map<string, AbortController>();
    bindNotificationSessionPumps(map1);
    const c1 = new AbortController();
    map1.set("portal:main:notification-inbox", c1);
    const pump1 = pumpUserNotificationInbox(
      {
        app_id: "portal",
        instance_id: "main",
        sendEvent(method, payload) {
          events1.push({ method, id: String((payload as { id?: string }).id ?? "") });
        },
      } as Parameters<typeof pumpUserNotificationInbox>[0],
      c1.signal,
    );

    // 等 watcher 挂上
    await Promise.resolve();
    emitUserNotificationCreated({
      id: "n1",
      title: "t1",
      body: "b1",
      created_at: new Date().toISOString(),
    });
    await new Promise<void>((r) => {
      setTimeout(r, 10);
    });
    expect(events1).toEqual([{ method: "notification.created", id: "n1" }]);

    // 模拟 WS close：abort + clear（与 ws-server.close 一致）
    for (const controller of map1.values()) controller.abort();
    map1.clear();
    await Promise.race([
      pump1,
      new Promise<void>((r) => {
        setTimeout(r, 50);
      }),
    ]);

    const map2 = new Map<string, AbortController>();
    bindNotificationSessionPumps(map2);
    const c2 = new AbortController();
    map2.set("portal:main:notification-inbox", c2);
    const pump2 = pumpUserNotificationInbox(
      {
        app_id: "portal",
        instance_id: "main",
        sendEvent(method, payload) {
          events2.push({ method, id: String((payload as { id?: string }).id ?? "") });
        },
      } as Parameters<typeof pumpUserNotificationInbox>[0],
      c2.signal,
    );

    await Promise.resolve();
    emitUserNotificationCreated({
      id: "n2",
      title: "t2",
      body: "b2",
      created_at: new Date().toISOString(),
    });
    await new Promise<void>((r) => {
      setTimeout(r, 10);
    });
    expect(events2).toEqual([{ method: "notification.created", id: "n2" }]);
    // 旧会话不应再收到
    expect(events1).toEqual([{ method: "notification.created", id: "n1" }]);

    c2.abort();
    await Promise.race([
      pump2,
      new Promise<void>((r) => {
        setTimeout(r, 50);
      }),
    ]);
  });

  test("旧模块级 Map 在 abort 后若不 clear 会挡住同 key 重建（回归原 bug）", async () => {
    const stale = new Map<string, AbortController>();
    bindNotificationSessionPumps(stale);
    const key = "portal:main:notification-inbox";
    const dead = new AbortController();
    stale.set(key, dead);

    // 模拟旧实现：断线未 abort/clear，重订发现 key 仍在则跳过
    const pumps = notificationSessionPumps();
    expect(pumps.has(key)).toBe(true);

    // 修复后 close 路径应 abort+clear，再 bind 新 Map 后无残留
    for (const c of stale.values()) c.abort();
    stale.clear();
    const fresh = new Map<string, AbortController>();
    bindNotificationSessionPumps(fresh);
    expect(notificationSessionPumps().has(key)).toBe(false);
  });
});
