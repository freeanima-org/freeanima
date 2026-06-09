import { describe, expect, test } from "bun:test";

import type { CronLogAppendInput } from "@freeanima/engine-repos";

import { setCronLogStore } from "./cron-log.ts";

describe("appendCronRunLog", () => {
  test("writes parsed JSON on success and error on failure", async () => {
    const rows: CronLogAppendInput[] = [];
    setCronLogStore({
      async append(row) {
        rows.push(row);
      },
      async list() {
        return [];
      },
    });

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

    setCronLogStore(null);
  });
});
