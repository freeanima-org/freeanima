import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  cancelScheduledAlert,
  getAlertScheduleDurability,
  registerAlertBackend,
  resetAlertBackendForTest,
  scheduleLocalAlert,
} from "./deliver.ts";
import { createWebAlertBackend, resetLiveWebNotificationsForTest } from "./web-backend.ts";

describe("scheduleLocalAlert / cancelScheduledAlert", () => {
  beforeEach(() => {
    resetAlertBackendForTest();
    resetLiveWebNotificationsForTest();
    registerAlertBackend(createWebAlertBackend());
  });

  afterEach(() => {
    resetLiveWebNotificationsForTest();
    resetAlertBackendForTest();
  });

  test("web durability 为 process", () => {
    expect(getAlertScheduleDurability()).toBe("process");
  });

  test("schedule 后 cancel 幂等且到点不弹", async () => {
    const shown: string[] = [];
    const backend = createWebAlertBackend();
    backend.show = async (payload) => {
      shown.push(payload.tag ?? payload.title);
    };
    registerAlertBackend(backend);

    const tag = "test:schedule:1";
    const result = await scheduleLocalAlert({ title: "t", tag }, new Date(Date.now() + 30));
    expect(result?.id).toBeTruthy();

    await cancelScheduledAlert({ tag });
    await cancelScheduledAlert({ tag });

    await new Promise<void>((r) => {
      setTimeout(r, 50);
    });
    expect(shown).toEqual([]);
  });

  test("同 tag replace：旧 timer 被取消", async () => {
    const shown: string[] = [];
    const backend = createWebAlertBackend();
    backend.show = async (payload) => {
      shown.push(payload.title);
    };
    registerAlertBackend(backend);

    const tag = "test:replace";
    await scheduleLocalAlert({ title: "first", tag }, new Date(Date.now() + 200));
    await scheduleLocalAlert({ title: "second", tag }, new Date(Date.now() + 40));

    await new Promise<void>((r) => {
      setTimeout(r, 80);
    });
    expect(shown).toEqual(["second"]);
  });

  test("无 backend 时 schedule 返回 null、cancel 不抛", async () => {
    resetAlertBackendForTest();
    expect(await scheduleLocalAlert({ title: "x", tag: "t" }, new Date())).toBeNull();
    await cancelScheduledAlert({ tag: "t" });
  });
});
