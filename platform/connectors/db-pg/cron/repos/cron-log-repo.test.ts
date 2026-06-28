import { describe, expect, test } from "bun:test";

import { mapRow } from "./cron-log-repo.ts";

describe("mapRow", () => {
  test("converts bigint id to number", () => {
    const row = mapRow({
      id: 42,
      job_id: "builtin-light-sleep",
      run_count: 1,
      ok: true,
      finished_at: new Date("2026-06-10T02:08:50.320+08:00"),
      output: { day: "2026-06-09" },
      output_text: null,
      error: null,
    });

    expect(row.id).toBe(42);
    expect(typeof row.id).toBe("number");
  });

  test("converts Date finished_at to ISO string", () => {
    const row = mapRow({
      id: 1,
      job_id: "builtin-deep-sleep",
      run_count: 2,
      ok: false,
      finished_at: new Date("2026-06-10T02:08:50.320Z"),
      output: null,
      output_text: null,
      error: "timeout",
    });

    expect(row.finished_at).toBe("2026-06-10T02:08:50.320Z");
  });

  test("preserves string finished_at", () => {
    const row = mapRow({
      id: 3,
      job_id: "builtin-light-sleep",
      run_count: 3,
      ok: true,
      finished_at: new Date("2026-06-09T18:07:32.000Z"),
      output: null,
      output_text: "ok",
      error: null,
    });

    expect(row.finished_at).toBe("2026-06-09T18:07:32.000Z");
  });
});
