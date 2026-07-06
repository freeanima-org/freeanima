import { describe, expect, it } from "bun:test";
import { CronJob } from "@freeanima/platform/connectors/cron/models";
import { shouldNotifyCronJobResult } from "./cron-notify.ts";

describe("shouldNotifyCronJobResult", () => {
  const job = new CronJob({ id: "j1", name: "test", schedule: "1h" });

  it("skips success when notify_on_success is false", () => {
    expect(shouldNotifyCronJobResult({ ...job, notify_on_success: false }, true)).toBe(false);
  });

  it("notifies success when notify_on_success is true", () => {
    expect(shouldNotifyCronJobResult({ ...job, notify_on_success: true }, true)).toBe(true);
  });

  it("always notifies failure", () => {
    expect(shouldNotifyCronJobResult({ ...job, notify_on_success: false }, false)).toBe(true);
  });
});
