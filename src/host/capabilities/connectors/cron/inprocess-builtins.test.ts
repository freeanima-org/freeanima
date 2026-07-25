import { afterEach, describe, expect, test } from "bun:test";

import {
  registerInprocessBuiltinFailureNotify,
  unregisterInprocessBuiltinFailureNotify,
} from "@freeanima/host/platform/ports/cron-notify";

import {
  registerCronBuiltinHandler,
  resetCronBuiltinHandlersForTests,
  unregisterCronBuiltinHandler,
} from "./builtin-handlers.ts";
import {
  INPROCESS_BUILTIN_DEFS,
  extractInprocessFailureMessage,
  fireInprocessBuiltinForTest,
  getInprocessBuiltinStatus,
  isInprocessBuiltinId,
  listInprocessBuiltinStatuses,
  resetInprocessBuiltinsForTest,
  startInprocessBuiltins,
  stopInprocessBuiltins,
} from "./inprocess-builtins.ts";

describe("inprocess-builtins", () => {
  afterEach(() => {
    resetInprocessBuiltinsForTest();
    resetCronBuiltinHandlersForTests();
    unregisterInprocessBuiltinFailureNotify();
  });

  test("extractInprocessFailureMessage 识别 ok:false / 缺 handler", () => {
    expect(extractInprocessFailureMessage(null)).toMatch(/not registered/);
    expect(extractInprocessFailureMessage(JSON.stringify({ ok: false, error: "boom" }))).toBe(
      "boom",
    );
    expect(extractInprocessFailureMessage(JSON.stringify({ ok: true, sent: 0 }))).toBeNull();
  });

  test("四类 builtin id 识别", () => {
    expect(isInprocessBuiltinId("builtin-sleep-cycle")).toBe(true);
    expect(isInprocessBuiltinId("builtin-task-reminders")).toBe(true);
    expect(isInprocessBuiltinId("builtin-env-health")).toBe(true);
    expect(isInprocessBuiltinId("builtin-temporal-summary-tick")).toBe(true);
    expect(isInprocessBuiltinId("builtin-email-sync-all")).toBe(false);
  });

  test("start 后可查询状态；stop 后可再次 start", () => {
    startInprocessBuiltins();
    expect(listInprocessBuiltinStatuses()).toHaveLength(INPROCESS_BUILTIN_DEFS.length);
    const sleep = getInprocessBuiltinStatus("builtin-sleep-cycle");
    expect(sleep?.schedule).toBe("0 2 * * *");
    expect(sleep?.run_count).toBe(0);

    stopInprocessBuiltins();
    startInprocessBuiltins();
    expect(getInprocessBuiltinStatus("builtin-task-reminders")?.name).toBe("task-reminders");
  });

  test("幂等 start 不重复武装", () => {
    startInprocessBuiltins();
    startInprocessBuiltins();
    expect(listInprocessBuiltinStatuses()).toHaveLength(4);
  });

  test("handler 注册后 fire 路径可跑通（手动调 handler）", async () => {
    let hits = 0;
    registerCronBuiltinHandler("builtin-env-health", async () => {
      hits += 1;
      return JSON.stringify({ ok: true });
    });
    startInprocessBuiltins();
    const { runCronBuiltinHandler } = await import("./builtin-handlers.ts");
    await runCronBuiltinHandler("builtin-env-health");
    expect(hits).toBe(1);
    unregisterCronBuiltinHandler("builtin-env-health");
  });

  test("失败时调用 failure notify（抛错与 ok:false）", async () => {
    const seen: Array<{ id: string; error: string }> = [];
    registerInprocessBuiltinFailureNotify(async (payload) => {
      seen.push({ id: payload.id, error: payload.error });
    });

    registerCronBuiltinHandler("builtin-task-reminders", async () => {
      return JSON.stringify({ ok: false, error: "port down" });
    });
    startInprocessBuiltins();
    await fireInprocessBuiltinForTest("builtin-task-reminders");
    expect(seen).toEqual([{ id: "builtin-task-reminders", error: "port down" }]);
    expect(getInprocessBuiltinStatus("builtin-task-reminders")?.last_ok).toBe(false);

    registerCronBuiltinHandler("builtin-env-health", async () => {
      throw new Error("tick exploded");
    });
    await fireInprocessBuiltinForTest("builtin-env-health");
    expect(
      seen.some((s) => s.id === "builtin-env-health" && s.error.includes("tick exploded")),
    ).toBe(true);
  });
});
