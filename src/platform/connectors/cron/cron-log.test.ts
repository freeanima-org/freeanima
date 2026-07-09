import { describe, expect, test, mock } from "bun:test";

import type { CronLogAppendInput } from "@freeanima/core/db/pg/cron";
import {
  createCronJob,
  deleteCronJob,
  getCronJob,
  listAllCronJobs,
  updateCronJob,
  upsertBuiltinCronJob,
} from "@freeanima/core/db/pg/cron/repos/cron-crud-repo.ts";
import { listCronLogs } from "@freeanima/core/db/pg/cron/repos/cron-log-repo.ts";

const appendCronLogMock = mock(async (row: CronLogAppendInput) => {
  rows.push(row);
});

const rows: CronLogAppendInput[] = [];

mock.module("@freeanima/core/db/pg/cron", () => ({
  createCronJob,
  upsertBuiltinCronJob,
  getCronJob,
  updateCronJob,
  deleteCronJob,
  listAllCronJobs,
  listCronLogs,
  appendCronLog: appendCronLogMock,
}));

describe("appendCronRunLog", () => {
  test("writes parsed JSON on success and error on failure", async () => {
    rows.length = 0;
    appendCronLogMock.mockClear();

    const { appendCronRunLog } = await import("./cron-log.ts");

    await appendCronRunLog({
      job_id: "builtin-light-sleep",
      run_count: 1,
      ok: true,
      outputText: JSON.stringify({ ok: true, day: "2026-06-08", tool_calls: 3 }),
    });
    await appendCronRunLog({
      job_id: "builtin-light-sleep",
      run_count: 2,
      ok: false,
      outputText: "ERROR: DrizzleQueryError: bad sql",
      error: "DrizzleQueryError: bad sql",
    });

    expect(rows[0]?.ok).toBe(true);
    expect(rows[0]?.output?.day).toBe("2026-06-08");
    expect(rows[1]?.ok).toBe(false);
    expect(rows[1]?.error).toContain("DrizzleQueryError");
  });
});
