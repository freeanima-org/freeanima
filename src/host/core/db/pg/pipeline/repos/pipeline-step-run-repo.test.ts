import { describe, expect, it } from "bun:test";

describe("appendPipelineStepRun attempt", () => {
  it("increments attempt per run_id and step_id", async () => {
    const rows: Array<{ run_id: string; step_id: string; attempt: number }> = [];
    let nextId = 0;

    const append = async (row: { run_id: string; step_id: string }): Promise<void> => {
      const attempt =
        rows.filter((r) => r.run_id === row.run_id && r.step_id === row.step_id).length + 1;
      rows.push({ run_id: row.run_id, step_id: row.step_id, attempt });
      nextId += 1;
    };

    await append({ run_id: "run-1", step_id: "light-sleep" });
    await append({ run_id: "run-1", step_id: "light-sleep" });
    await append({ run_id: "run-1", step_id: "deep-sleep" });

    expect(rows).toEqual([
      { run_id: "run-1", step_id: "light-sleep", attempt: 1 },
      { run_id: "run-1", step_id: "light-sleep", attempt: 2 },
      { run_id: "run-1", step_id: "deep-sleep", attempt: 1 },
    ]);
    expect(nextId).toBe(3);
  });
});
