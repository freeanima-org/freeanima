import { describe, expect, it } from "bun:test";
import {
  companionConfigSchema,
  defaultCompanionRuntimeConfig,
  nextCompanionSort,
} from "./companion.ts";

describe("companionConfigSchema", () => {
  it("accepts default companion runtime config", () => {
    const parsed = companionConfigSchema.parse(defaultCompanionRuntimeConfig());
    expect(parsed.active_object_file_id).toBeNull();
    expect(parsed.models).toEqual([]);
    expect(parsed.motion_slots.idle).toEqual([]);
    expect(parsed.behavior.patrol_enabled).toBe(true);
  });

  it("requires object_file_id and sort on models", () => {
    const parsed = companionConfigSchema.parse({
      ...defaultCompanionRuntimeConfig(),
      active_object_file_id: 42,
      models: [{ name: "A", object_file_id: 42, sort: 0 }],
    });
    expect(parsed.models[0]?.object_file_id).toBe(42);
    expect(parsed.models[0]?.sort).toBe(0);
  });

  it("nextCompanionSort increments", () => {
    expect(nextCompanionSort([])).toBe(0);
    expect(nextCompanionSort([{ sort: 0 }, { sort: 2 }])).toBe(3);
  });
});
