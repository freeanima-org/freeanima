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
  createJob,
  initCronModule,
  stopCronModule,
} from "@freeanima/habitat/capabilities/connectors/cron";
import { getAppRuntime } from "@freeanima/habitat/platform";
import {
  listCronJobs,
  pauseCronJob,
  resumeCronJob,
  runCronJobNow,
  createCronJob,
  deleteCronJob,
  ApiHandlerError,
} from "@freeanima/features/habitat/habitat/habitat-api/handlers";

describePg("server cron API", () => {
  let home: string;
  let jobId: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("anima-cron-api-");
    home = ctx.home;
    await initCronModule();
    mkdirSync(join(home, "cron", "scripts"), { recursive: true });
    writeFileSync(join(home, "cron", "scripts", "noop.js"), "console.log('ok');\n", "utf-8");
    const j = await createJob({
      name: "api-test",
      schedule: "1h",
      prompt: "",
      no_agent: true,
      script: "noop.js",
    });
    jobId = j.id;
  });

  afterEach(async () => {
    stopCronModule();
    await restoreIntegrationHome(prev);
  });

  it("AppRuntime pause and resume cron job", async () => {
    const svc = getAppRuntime();

    const paused = await svc.pauseCronJob(jobId);
    expect(paused).not.toBeNull();
    expect(paused!.paused).toBe(true);
    expect(paused!.next_run_at).toBe(0);

    const resumed = await svc.resumeCronJob(jobId);
    expect(resumed).not.toBeNull();
    expect(resumed!.paused).toBe(false);
    expect(resumed!.next_run_at).toBeGreaterThan(0);
  });

  it("AppRuntime runCronJobNow returns message for existing job", async () => {
    const svc = getAppRuntime();
    const result = await svc.runCronJobNow(jobId);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("api-test");
    expect(result!.job.id).toBe(jobId);
    await new Promise((r) => {
      setTimeout(r, 150);
    });
  });

  it("AppRuntime returns null for unknown job id", async () => {
    const svc = getAppRuntime();
    expect(await svc.pauseCronJob("missing-id")).toBeNull();
    expect(await svc.resumeCronJob("missing-id")).toBeNull();
    expect(await svc.runCronJobNow("missing-id")).toBeNull();
  });

  it("AppRuntime create and delete cron job", async () => {
    const svc = getAppRuntime();
    const created = await svc.createCronJob({
      name: "created-via-runtime",
      schedule: "2h",
      prompt: "say hello",
      notify_on_success: false,
    });
    expect(created.name).toBe("created-via-runtime");
    expect(created.id).toBeTruthy();

    const listed = await svc.listCronJobs();
    expect(listed.jobs.some((j) => j.id === created.id)).toBe(true);

    expect(await svc.deleteCronJob(created.id)).toBe(true);
    const after = await svc.listCronJobs();
    expect(after.jobs.some((j) => j.id === created.id)).toBe(false);
  });

  it("handler pause/resume/run and 404", async () => {
    const pauseBody = await pauseCronJob(jobId);
    expect(pauseBody.ok).toBe(true);
    expect(pauseBody.job.paused).toBe(true);

    const resumeBody = await resumeCronJob(jobId);
    expect(resumeBody.job.paused).toBe(false);

    const runBody = await runCronJobNow(jobId);
    expect(runBody.ok).toBe(true);
    expect(runBody.message).toContain("api-test");

    await expect(pauseCronJob("no-such-job")).rejects.toThrow(ApiHandlerError);
  });

  it("handler create/delete and errors", async () => {
    const created = await createCronJob({
      name: "handler-create",
      schedule: "30m",
      prompt: "ping",
    });
    expect(created.ok).toBe(true);
    expect(created.job.name).toBe("handler-create");

    const listed = await listCronJobs();
    expect(listed.jobs.some((j) => j.id === created.job.id)).toBe(true);

    const deleted = await deleteCronJob(created.job.id);
    expect(deleted.ok).toBe(true);
    expect(deleted.job_id).toBe(created.job.id);

    await expect(deleteCronJob("no-such-job")).rejects.toThrow(ApiHandlerError);
    await expect(
      createCronJob({ name: "bad", schedule: "not-a-schedule", prompt: "x" }),
    ).rejects.toThrow(ApiHandlerError);
  });

  it("listCronJobs lists jobs", async () => {
    const body = await listCronJobs();
    expect(body.jobs.some((j) => j.id === jobId)).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
