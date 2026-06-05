import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { waitFor } from "../../helpers/wait.ts";
import {
  parseSchedule,
  ScheduleType,
  createJob,
  listJobs,
  getJob,
  pauseJob,
  resumeJob,
  ensureBuiltinCronJobs,
  runL2GapFill,
  resolveDeliverTargets,
  CronJob,
  deliverCronResult,
  registerCronDeliverer,
  unregisterCronDeliverer,
  enqueueRunJob,
  Scheduler,
  cronStore,
} from "@freeanima/service";
import { patchConfigSection } from "@freeanima/service-config";
import { seedSession } from "@freeanima/kernel-db/test-helpers";

describePg("cron", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("anima-cron-");
    home = ctx.home;
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("parseSchedule interval", () => {
    const [t, v] = parseSchedule("30m");
    expect(t).toBe(ScheduleType.INTERVAL);
    expect(v).toBe(1800);
  });

  it("createJob and listJobs", () => {
    const j = createJob({
      name: "test",
      schedule: "1h",
      prompt: "say hi",
    });
    expect(j.id).toBeTruthy();
    expect(listJobs().length).toBe(1);
    expect(getJob(j.id)?.name).toBe("test");
    expect(pauseJob(j.id)).toBe(true);
    expect(getJob(j.id)?.paused).toBe(true);
    expect(resumeJob(j.id)).toBe(true);
    ensureBuiltinCronJobs();
    ensureBuiltinCronJobs();
    expect(listJobs().some((x) => x.id === "l2-gap-fill")).toBe(true);
  });

  it.skipIf(typeof Bun !== "undefined")("runL2GapFill distills PG session without L2", async () => {
    await seedSession(
      "20260531_gapfill_a",
      {
        role: "session_meta",
        model: "test-model",
        tools: [],
        functions: [],
        timestamp: new Date().toISOString(),
        platform: "parlor",
      },
      [
        {
          role: "user",
          content: "x",
          pos: 1,
          timestamp: new Date().toISOString(),
        },
      ],
    );
    const out = await runL2GapFill();
    expect(out).toContain("L2 gap-fill");
  });

  it("resolveDeliverTargets", () => {
    expect(resolveDeliverTargets("local")).toEqual([]);
    expect(resolveDeliverTargets("discord:123")).toEqual([{ platform: "discord", chat_id: "123" }]);
    expect(resolveDeliverTargets("discord:123:456")).toEqual([
      { platform: "discord", chat_id: "123", thread_id: "456" },
    ]);
    patchConfigSection("discord", { home_channel: "999", home_thread_id: "888" });
    expect(resolveDeliverTargets("discord")).toEqual([
      { platform: "discord", chat_id: "999", thread_id: "888" },
    ]);
  });

  it("deliverCronResult invokes registered handler", async () => {
    const delivered: string[] = [];
    registerCronDeliverer("discord", async (_target, text) => {
      delivered.push(text);
    });
    const job = new CronJob({
      id: "t1",
      name: "test-job",
      schedule: "1h",
      deliver: "discord:1",
    });
    await deliverCronResult(job, { jobName: job.name, success: true, output: "ok" });
    expect(delivered).toEqual(["ok"]);
    unregisterCronDeliverer("discord");
  });

  it("enqueueRunJob returns before spawnSync script finishes", async () => {
    mkdirSync(join(home, "cron", "scripts"), { recursive: true });
    const scriptPath = join(home, "cron", "scripts", "slow.sh");
    writeFileSync(scriptPath, "#!/usr/bin/env bash\nsleep 0.05\necho slow-ok\n", {
      mode: 0o755,
    });
    const j = createJob({
      name: "slow",
      schedule: "1h",
      no_agent: true,
      script: "slow.sh",
      timeout_sec: 60,
    });
    const before = getJob(j.id)!.last_output;
    void enqueueRunJob(getJob(j.id)!);
    // 调用方同步返回时脚本尚未 spawn（与 HTTP /run 行为一致）
    expect(getJob(j.id)!.last_output).toBe(before);
    await waitFor(() => (getJob(j.id)?.last_output ?? "").includes("slow-ok"), {
      timeoutMs: 800,
    });
  });

  it("scheduler skips concurrent runs for same job", async () => {
    mkdirSync(join(home, "cron"), { recursive: true });
    const job = new CronJob({
      id: "slow-job",
      name: "slow",
      schedule: "1h",
      no_agent: true,
      script: null,
      next_run_at: 1,
    });
    cronStore.saveAll([job]);

    let active = 0;
    let maxActive = 0;
    const scheduler = new Scheduler();
    scheduler.start(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 15));
      active -= 1;
    });

    const tick = (scheduler as unknown as { tick: () => Promise<void> }).tick.bind(scheduler);
    await tick();
    await tick();
    await new Promise((r) => setTimeout(r, 40));
    scheduler.stop();
    expect(maxActive).toBe(1);
  });

  it("createJob stores timeout_sec", () => {
    const j = createJob({
      name: "long",
      schedule: "1h",
      prompt: "x",
      no_agent: true,
      script: "noop.sh",
      timeout_sec: 1800,
    });
    expect(getJob(j.id)?.timeout_sec).toBe(1800);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
