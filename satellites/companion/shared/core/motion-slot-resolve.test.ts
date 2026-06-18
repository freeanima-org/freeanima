import { describe, expect, test } from "bun:test";
import { normalizeMotionSlots, resolveMotionForSlot } from "./motion-slot-resolve.ts";

describe("resolveMotionForSlot", () => {
  const library = [
    { id: "m1", name: "Idle", file: "VRMA_01.vrma" },
    { id: "m2", name: "Wave", file: "VRMA_02.vrma" },
  ];

  test("指定 motion id", () => {
    const slots = { idle: ["m1", "m2"], rest: [], walk: [], climb: [], in_place: [] };
    expect(resolveMotionForSlot("idle", slots, library, { motionId: "m2" })?.file).toBe(
      "VRMA_02.vrma",
    );
  });

  test("指定 id 不存在时回退随机", () => {
    const slots = { idle: ["m1"], rest: [], walk: [], climb: [], in_place: [] };
    const resolved = resolveMotionForSlot("idle", slots, library, { motionId: "missing" });
    expect(resolved?.file).toBe("VRMA_01.vrma");
  });

  test("槽位为空返回 null", () => {
    const slots = { idle: [], rest: [], walk: [], climb: [], in_place: [] };
    expect(resolveMotionForSlot("walk", slots, library)).toBeNull();
  });
});

describe("normalizeMotionSlots", () => {
  test("合并 legacy in_place_* 到 in_place", () => {
    const library = [
      { id: "h", name: "Head", file: "VRMA_02.vrma" },
      { id: "t", name: "Torso", file: "VRMA_06.vrma" },
    ];
    const normalized = normalizeMotionSlots(
      {
        idle: ["VRMA_01.vrma"],
        in_place_head: ["h"],
        in_place_torso: ["t"],
      },
      library,
    );
    expect(normalized.in_place.toSorted()).toEqual(["h", "t"]);
    expect(normalized.idle).toEqual(["VRMA_01.vrma"]);
  });
});
