import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseSchedule,
  ScheduleType,
  createJob,
  listJobs,
  getJob,
  pauseJob,
  resumeJob,
  ensureBuiltinCronJobs,
  resolveDeliverTargets,
  CronJob,
  deliverCronResult,
  registerCronDeliverer,
  unregisterCronDeliverer,
  enqueueRunJob,
  initCronModule,
  stopCronModule,
  computeNextRunAt,
  readOutputRef,
} from "@freeanima/connectors-cron";
import { patchConfigSection } from "@freeanima/service-config";

describePg("cron", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("anima-cron-");
    home = ctx.home;
    await initCronModule({ store: ctx.pg.engine.repos.cron });
  });

  afterEach(async () => {
    stopCronModule();
    await restoreIntegrationHome(prev);
  });

  it("parseSchedule interval", () => {
    const [t, v] = parseSchedule("30m");
    expect(t).toBe(ScheduleType.INTERVAL);
    expect(v).toBe(1800);
  });

  it("createJob and listJobs", async () => {
    const j = await createJob({
      name: "test",
      schedule: "1h",
      prompt: "say hi",
    });
    expect(j.id).toBeTruthy();
    expect((await listJobs()).length).toBeGreaterThanOrEqual(1);
    expect((await getJob(j.id))?.name).toBe("test");
    expect(await pauseJob(j.id)).toBe(true);
    expect((await getJob(j.id))?.paused).toBe(true);
    expect(computeNextRunAt("1h", true)).toBe(0);
    expect(await resumeJob(j.id)).toBe(true);
    await ensureBuiltinCronJobs();
    await ensureBuiltinCronJobs();
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
    const j = await createJob({
      name: "slow",
      schedule: "1h",
      no_agent: true,
      script: "slow.sh",
      timeout_sec: 60,
    });
    const before = readOutputRef((await getJob(j.id))?.last_output_ref);
    void enqueueRunJob((await getJob(j.id))!);
    expect(readOutputRef((await getJob(j.id))?.last_output_ref)).toBe(before);
    const deadline = Date.now() + 800;
    let done = false;
    while (Date.now() < deadline) {
      const job = await getJob(j.id);
      if (readOutputRef(job?.last_output_ref).includes("slow-ok")) {
        done = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(done).toBe(true);
  });

  it("createJob stores timeout_sec", async () => {
    const j = await createJob({
      name: "long",
      schedule: "1h",
      prompt: "x",
      no_agent: true,
      script: "noop.sh",
      timeout_sec: 1800,
    });
    expect((await getJob(j.id))?.timeout_sec).toBe(1800);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
