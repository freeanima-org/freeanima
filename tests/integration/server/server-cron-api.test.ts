import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createJob, NestService } from "@freeanima/service";
import { getAcpManager } from "@freeanima/capabilities-acp";
import {
  listCronJobs,
  pauseCronJob,
  resumeCronJob,
  runCronJobNow,
  ApiHandlerError,
} from "@freeanima/connectors-webui/handlers";
import { initServiceContext } from "@freeanima/service";

describePg("server cron API", () => {
  let home: string;
  let jobId: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("anima-cron-api-");
    home = ctx.home;
    mkdirSync(join(home, "cron", "scripts"), { recursive: true });
    writeFileSync(join(home, "cron", "scripts", "noop.js"), "console.log('ok');\n", "utf-8");
    const j = createJob({
      name: "api-test",
      schedule: "1h",
      prompt: "",
      no_agent: true,
      script: "noop.js",
    });
    jobId = j.id;
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("NestService pause and resume cron job", () => {
    const svc = new NestService();

    const paused = svc.pauseCronJob(jobId);
    expect(paused).not.toBeNull();
    expect(paused!.paused).toBe(true);
    expect(paused!.next_run_at).toBe(0);

    const resumed = svc.resumeCronJob(jobId);
    expect(resumed).not.toBeNull();
    expect(resumed!.paused).toBe(false);
    expect(resumed!.next_run_at).toBeGreaterThan(0);
  });

  it("NestService runCronJobNow returns message for existing job", () => {
    const svc = new NestService();
    const result = svc.runCronJobNow(jobId);
    expect(result).not.toBeNull();
    expect(result!.message).toContain("api-test");
    expect(result!.job.id).toBe(jobId);
  });

  it("NestService returns null for unknown job id", () => {
    const svc = new NestService();
    expect(svc.pauseCronJob("missing-id")).toBeNull();
    expect(svc.resumeCronJob("missing-id")).toBeNull();
    expect(svc.runCronJobNow("missing-id")).toBeNull();
  });

  it("handler pause/resume/run and 404", () => {
    const svc = new NestService();
    initServiceContext({
      service: svc,
      mcp: null,
      acp: getAcpManager(),
      host: "127.0.0.1",
      port: 2658,
    });

    const pauseBody = pauseCronJob(jobId);
    expect(pauseBody.ok).toBe(true);
    expect(pauseBody.job.paused).toBe(true);

    const resumeBody = resumeCronJob(jobId);
    expect(resumeBody.job.paused).toBe(false);

    const runBody = runCronJobNow(jobId);
    expect(runBody.ok).toBe(true);
    expect(runBody.message).toContain("api-test");

    expect(() => pauseCronJob("no-such-job")).toThrow(ApiHandlerError);
  });

  it("listCronJobs lists jobs", () => {
    const svc = new NestService();
    initServiceContext({
      service: svc,
      mcp: null,
      acp: getAcpManager(),
      host: "127.0.0.1",
      port: 2658,
    });

    const body = listCronJobs();
    expect(body.jobs.some((j: { id: string }) => j.id === jobId)).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
