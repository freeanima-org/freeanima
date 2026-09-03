import { describe, expect, test } from "bun:test";

import {
  objectiveBodySchema,
  objectiveCompletionSchema,
} from "@freeanima/habitat/core/db/schema/entity/components/objective.ts";
import { assertCompletionSupported, resolveObjectiveProgress } from "./resolve-progress.ts";

describe("objectiveCompletionSchema", () => {
  test("accepts qualitative", () => {
    const parsed = objectiveCompletionSchema.safeParse({ kind: "qualitative" });
    expect(parsed.success).toBe(true);
  });

  test("accepts metric_manual", () => {
    const parsed = objectiveCompletionSchema.safeParse({
      kind: "metric_manual",
      unit: "km",
      target: 100,
      current: 32,
    });
    expect(parsed.success).toBe(true);
  });

  test("accepts tasks_completed auto", () => {
    const parsed = objectiveCompletionSchema.safeParse({
      kind: "metric_auto",
      unit: "个",
      target: 3,
      source: { type: "tasks_completed", task_ids: [1, 2, 3] },
    });
    expect(parsed.success).toBe(true);
  });

  test("accepts children_completed auto", () => {
    const parsed = objectiveCompletionSchema.safeParse({
      kind: "metric_auto",
      unit: "个",
      target: 0,
      source: { type: "children_completed" },
    });
    expect(parsed.success).toBe(true);
  });

  test("accepts habit source in schema", () => {
    const parsed = objectiveCompletionSchema.safeParse({
      kind: "metric_auto",
      unit: "次",
      target: 10,
      source: { type: "habit", habit_id: 9 },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("objectiveBodySchema", () => {
  test("defaults status and qualitative completion", () => {
    const parsed = objectiveBodySchema.parse({});
    expect(parsed.status).toBe("not_started");
    expect(parsed.completion).toEqual({ kind: "qualitative" });
    expect(parsed.links).toEqual([]);
  });
});

describe("assertCompletionSupported", () => {
  test("allows habit source", () => {
    expect(() =>
      assertCompletionSupported({
        kind: "metric_auto",
        unit: "次",
        target: 1,
        source: { type: "habit", habit_id: 1 },
      }),
    ).not.toThrow();
  });

  test("allows manual metric", () => {
    expect(() =>
      assertCompletionSupported({
        kind: "metric_manual",
        unit: "km",
        target: 100,
        current: 0,
      }),
    ).not.toThrow();
  });
});

describe("resolveObjectiveProgress", () => {
  test("qualitative returns undefined", async () => {
    const progress = await resolveObjectiveProgress(1, {
      completion: { kind: "qualitative" },
      start_at: null,
      end_at: null,
    });
    expect(progress).toBeUndefined();
  });

  test("metric_manual uses body current", async () => {
    const progress = await resolveObjectiveProgress(1, {
      completion: {
        kind: "metric_manual",
        unit: "km",
        target: 100,
        current: 40,
      },
      start_at: null,
      end_at: null,
    });
    expect(progress).toEqual({
      current: 40,
      target: 100,
      unit: "km",
      ratio: 0.4,
      source: "manual",
    });
  });
});
