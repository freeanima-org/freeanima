import { describe, expect, it } from "bun:test";

import { validateToolArgs } from "@freeanima/habitat/core/tool";
import { rejectTasksMixedWithSugar } from "./subagent-tools.ts";

const taskProps = {
  goal: { type: "string" },
  slug: { type: "string" },
  instructions: { type: "string" },
  allowed_tools: { type: "array", items: { type: "string" } },
} as const;

const runParams = {
  type: "object" as const,
  properties: {
    subject_id: { type: "integer", description: "Owning subject entity id" },
    ...taskProps,
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: taskProps,
        required: ["goal"],
      },
    },
  },
  required: ["subject_id"],
};

describe("subagent_run args", () => {
  it("rejects unknown keys inside tasks[]", () => {
    const result = validateToolArgs(runParams, {
      subject_id: 1,
      tasks: [{ goal: "查", prompt: "误当任务定义" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/prompt|Unrecognized/i);
    }
  });

  it("rejects mixing tasks with top-level goal", () => {
    const msg = rejectTasksMixedWithSugar({
      subject_id: 1,
      goal: "查",
      tasks: [{ goal: "查" }],
    });
    expect(msg).toContain("tasks 与单任务字段不能同时出现");
    expect(msg).toContain("goal");
  });

  it("allows parallel tasks without sugar", () => {
    expect(
      rejectTasksMixedWithSugar({
        subject_id: 1,
        tasks: [{ goal: "a", slug: "explorer" }],
      }),
    ).toBeNull();
  });
});
