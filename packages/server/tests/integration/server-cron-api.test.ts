import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { describePg } from "../../../db/tests/helpers/pg-test-gate.ts";
import { beginIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";
import { endIntegrationCase } from "../../../db/tests/helpers/integration-case.ts";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createJob, NestService } from "@freeanima/runtime";
import { createApp } from "@freeanima/server";

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
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
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

  it("HTTP POST pause/resume/run and 404", async () => {
    const svc = new NestService();
    const { app } = createApp(svc, "", "", 0, null, null);

    const pauseRes = await app.request(`/api/cron/${jobId}/pause`, { method: "POST" });
    expect(pauseRes.status).toBe(200);
    const pauseBody = await pauseRes.json();
    expect(pauseBody.ok).toBe(true);
    expect(pauseBody.job.paused).toBe(true);

    const resumeRes = await app.request(`/api/cron/${jobId}/resume`, { method: "POST" });
    expect(resumeRes.status).toBe(200);
    const resumeBody = await resumeRes.json();
    expect(resumeBody.job.paused).toBe(false);

    const runRes = await app.request(`/api/cron/${jobId}/run`, { method: "POST" });
    expect(runRes.status).toBe(200);
    const runBody = await runRes.json();
    expect(runBody.ok).toBe(true);
    expect(runBody.message).toContain("api-test");

    const missing = await app.request("/api/cron/no-such-job/pause", { method: "POST" });
    expect(missing.status).toBe(404);
    const errBody = await missing.json();
    expect(errBody.error).toBeTruthy();
  });

  it("GET /api/cron lists jobs", async () => {
    const svc = new NestService();
    const { app } = createApp(svc, "", "", 0, null, null);

    const res = await app.request("/api/cron");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobs.some((j: { id: string }) => j.id === jobId)).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
