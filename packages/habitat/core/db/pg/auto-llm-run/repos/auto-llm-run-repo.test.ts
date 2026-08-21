import { describe, expect, test } from "bun:test";

import { mapAutoLlmRunRow, type AutoLlmRunDbRow } from "./auto-llm-run-repo.ts";

function rawRun(over: Partial<AutoLlmRunDbRow> = {}): AutoLlmRunDbRow {
  return {
    id: "run-1",
    run_name: "title",
    run_kind: "chat",
    subject_id: 1,
    output: "hello",
    status: "ok",
    duration_ms: 12,
    max_loop_iterations: 50,
    max_duration_ms: null,
    error: null,
    metadata: { k: 1 },
    created_at: new Date("2026-08-19T00:00:00.000Z"),
    finished_at: new Date("2026-08-19T00:00:01.000Z"),
    ...over,
  };
}

describe("mapAutoLlmRunRow", () => {
  test("finished_at null / epoch 0 → null；合法 Date 非空", () => {
    expect(mapAutoLlmRunRow(rawRun({ finished_at: null })).finished_at).toBeNull();
    expect(mapAutoLlmRunRow(rawRun({ finished_at: new Date(0) })).finished_at).toBeNull();
    expect(mapAutoLlmRunRow(rawRun()).finished_at).not.toBeNull();
  });

  test("透传运行字段并把 Date 列转成字符串", () => {
    const row = mapAutoLlmRunRow(rawRun({ subject_id: 7, max_duration_ms: 1000 }));
    expect(row.id).toBe("run-1");
    expect(row.status).toBe("ok");
    expect(row.subject_id).toBe(7);
    expect(row.max_duration_ms).toBe(1000);
    expect(typeof row.created_at).toBe("string");
  });

  test("subject_id 可空", () => {
    expect(mapAutoLlmRunRow(rawRun({ subject_id: null })).subject_id).toBeNull();
  });
});
