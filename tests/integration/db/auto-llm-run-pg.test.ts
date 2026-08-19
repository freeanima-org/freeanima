import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  abortOrphanAutoLlmRuns,
  appendAutoLlmMessages,
  finishAutoLlmRun,
  getAutoLlmRun,
  insertRunningAutoLlmRun,
  listAutoLlmMessages,
  listAutoLlmRuns,
  purgeStaleAutoLlmRuns,
} from "@freeanima/habitat/core/db/pg/auto-llm-run";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

describePg("auto_llm_runs process persist", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("auto-llm-run-");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prevHome);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });

  it("insert running, append messages, finish", async () => {
    const id = `autollm_test_${randomUUID()}`;
    const started = isoMinutesAgo(1);
    await insertRunningAutoLlmRun({
      id,
      run_name: "test-cron",
      run_kind: "cron",
      subject_id: 2,
      max_loop_iterations: 5,
      max_duration_ms: 60_000,
      metadata: { tool_names: ["web_search"], job_id: "job-1" },
      created_at: started,
      messages: [
        { pos: 0, payload: { role: "system", content: "sys", timestamp: started } },
        { pos: 1, payload: { role: "user", content: "do", timestamp: started } },
      ],
    });

    const running = await getAutoLlmRun(id);
    expect(running?.status).toBe("running");
    expect(running?.output).toBe("");
    expect(running?.finished_at).toBeNull();
    expect(running?.duration_ms).toBe(0);

    await appendAutoLlmMessages(id, [
      {
        pos: 2,
        payload: { role: "assistant", content: "done", timestamp: new Date().toISOString() },
      },
    ]);
    await finishAutoLlmRun({
      id,
      status: "ok",
      output: "done",
      duration_ms: 42,
    });

    const done = await getAutoLlmRun(id);
    expect(done?.status).toBe("ok");
    expect(done?.output).toBe("done");
    expect(done?.duration_ms).toBe(42);
    expect(done?.finished_at).toBeTruthy();

    const msgs = await listAutoLlmMessages(id);
    expect(msgs).toHaveLength(3);
    expect(msgs[2]?.payload.role).toBe("assistant");
    expect(msgs[2]?.payload.role === "assistant" && msgs[2].payload.content).toBe("done");
  });

  it("abortOrphanAutoLlmRuns marks leftover running as error", async () => {
    const id = `autollm_orphan_${randomUUID()}`;
    await insertRunningAutoLlmRun({
      id,
      run_name: "orphan",
      run_kind: "cron",
      subject_id: 2,
      max_loop_iterations: 1,
      created_at: isoMinutesAgo(5),
    });

    const { aborted } = await abortOrphanAutoLlmRuns();
    expect(aborted).toBeGreaterThanOrEqual(1);

    const row = await getAutoLlmRun(id);
    expect(row?.status).toBe("error");
    expect(row?.error).toBe("栖息地重启，运行中断");
    expect(row?.finished_at).toBeTruthy();
  });

  it("purgeStaleAutoLlmRuns skips running rows", async () => {
    const kind = `purge-${randomUUID()}`;
    const runningId = `autollm_purge_run_${randomUUID()}`;
    const finishedId = `autollm_purge_ok_${randomUUID()}`;
    const old = isoMinutesAgo(60 * 24);

    await insertRunningAutoLlmRun({
      id: runningId,
      run_name: "keep-running",
      run_kind: kind,
      subject_id: 2,
      max_loop_iterations: 1,
      created_at: old,
    });
    await insertRunningAutoLlmRun({
      id: finishedId,
      run_name: "drop-finished",
      run_kind: kind,
      subject_id: 2,
      max_loop_iterations: 1,
      created_at: old,
    });
    await finishAutoLlmRun({
      id: finishedId,
      status: "ok",
      output: "old",
      duration_ms: 1,
      finished_at: old,
    });

    const { deleted } = await purgeStaleAutoLlmRuns({ olderThan: new Date() });
    expect(deleted).toBeGreaterThanOrEqual(1);

    expect(await getAutoLlmRun(runningId)).not.toBeNull();
    expect(await getAutoLlmRun(finishedId)).toBeNull();
  });

  it("listAutoLlmRuns puts running first", async () => {
    const kind = `list-${randomUUID()}`;
    const finishedId = `autollm_list_ok_${randomUUID()}`;
    const runningId = `autollm_list_run_${randomUUID()}`;

    await insertRunningAutoLlmRun({
      id: finishedId,
      run_name: "finished",
      run_kind: kind,
      subject_id: 2,
      max_loop_iterations: 1,
      created_at: isoMinutesAgo(2),
    });
    await finishAutoLlmRun({
      id: finishedId,
      status: "ok",
      output: "done",
      duration_ms: 10,
    });
    await insertRunningAutoLlmRun({
      id: runningId,
      run_name: "running",
      run_kind: kind,
      subject_id: 2,
      max_loop_iterations: 1,
      created_at: isoMinutesAgo(1),
    });

    const rows = await listAutoLlmRuns({ run_kind: kind, limit: 10 });
    expect(rows[0]?.id).toBe(runningId);
    expect(rows[0]?.status).toBe("running");
  });
});
