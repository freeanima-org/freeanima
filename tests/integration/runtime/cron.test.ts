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
  CronJob,
  deliverToTargets,
  registerCronDeliverer,
  unregisterCronDeliverer,
  enqueueRunJob,
  initCronModule,
  stopCronModule,
  computeNextRunAt,
  readOutputRef,
} from "@freeanima/platform/connectors/cron";
import { getActivePgTestContext } from "../../helpers/pg-test.ts";
import { listNotifications } from "@freeanima/core/db/pg/notifications";
import { getResolvedWorldContext } from "@freeanima/core/config/world-context";
import { bindServicePorts } from "@freeanima/platform";
import { FileConfig } from "@freeanima/platform/config/file-config.ts";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import { createConversationService } from "@freeanima/runtime/conversation";
import { MaskRegistry } from "@freeanima/features/task/domain/mask";
import { getAcpManager } from "@freeanima/capabilities/acp";
import { createAppRuntime } from "@freeanima/platform/runtime/app-runtime";
import { initRuntimeContext } from "@freeanima/platform/runtime/runtime-context";
import { registerServiceStores } from "@freeanima/platform";
import { registerCronNotify } from "@freeanima/platform/ports/cron-notify";
import { notifyBothRecipients } from "@freeanima/platform/runtime/notification-helpers";

describePg("cron", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("anima-cron-");
    home = ctx.home;
    await initCronModule();
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

  it("deliverToTargets invokes registered handler", async () => {
    const delivered: string[] = [];
    registerCronDeliverer("discord", async (_target, text) => {
      delivered.push(text);
    });
    await deliverToTargets([{ platform: "discord", chat_id: "1" }], "ok");
    expect(delivered).toEqual(["ok"]);
    unregisterCronDeliverer("discord");
  });

  it("notifyCronResult respects notify_on_success on success", async () => {
    const pg = getActivePgTestContext()!;
    if (!(pg.config instanceof FileConfig)) throw new Error("expected FileConfig");

    const kernel = createServiceKernel(pg.config);
    const conversation = createConversationService(pg.engine.catalog.toolSets);
    const fullDeps = {
      kernel,
      engine: pg.engine,
      conversation,
      masks: new MaskRegistry(),
      mcp: null,
      satellite: null,
      acp: getAcpManager(),
      host: "127.0.0.1",
      port: 2658,
    };
    const runtime = createAppRuntime(fullDeps);
    bindServicePorts(fullDeps);
    initRuntimeContext(runtime);
    registerServiceStores(fullDeps, pg.config);

    registerCronNotify(async (job, payload) => {
      const title = payload.success ? `Cron: ${job.name}` : `Cron failed: ${job.name}`;
      const body = payload.success ? payload.output : (payload.error ?? payload.output);
      await notifyBothRecipients(fullDeps, pg.config, {
        title,
        body,
        source_kind: "cron",
        source_ref: `${job.id}:${payload.success ? "ok" : "fail"}`,
      });
    });

    const { notifyCronResult, shouldNotifyCronJobResult } =
      await import("@freeanima/platform/ports/cron-notify");
    const quiet = new CronJob({
      id: "t-quiet",
      name: "quiet-job",
      schedule: "1h",
      notify_on_success: false,
    });
    const loud = new CronJob({
      id: "t-loud",
      name: "loud-job",
      schedule: "1h",
      notify_on_success: true,
    });

    expect(shouldNotifyCronJobResult(quiet, true)).toBe(false);
    expect(shouldNotifyCronJobResult(loud, true)).toBe(true);
    expect(shouldNotifyCronJobResult(quiet, false)).toBe(true);

    await notifyCronResult(loud, { jobName: loud.name, success: true, output: "ok" });
    await notifyCronResult(quiet, {
      jobName: quiet.name,
      success: false,
      output: "err",
      error: "err",
    });

    const userSubjectId = String(getResolvedWorldContext().user_subject_id);
    const userRows = await listNotifications({
      recipient_kind: "user",
      recipient_id: userSubjectId,
      read_filter: "all",
    });
    expect(userRows.some((row) => row.source_ref === "t-loud:ok")).toBe(true);
    expect(userRows.some((row) => row.source_ref === "t-quiet:ok")).toBe(false);
    expect(userRows.some((row) => row.source_ref === "t-quiet:fail")).toBe(true);
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
      await new Promise((r) => {
        setTimeout(r, 25);
      });
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
