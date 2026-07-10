import { describe, expect, test } from "bun:test";
import {
  normalizeMotionSlots,
  resolveLocomotionMotion,
  resolveMotionForSlot,
} from "@freeanima/shared/companion-motion/motion-slot-resolve.ts";

const defaultLocomotion = { walk: "mot_walk.vrma" };

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

  test("槽位仍引用已重命名的 locomotion 文件名", () => {
    const libraryWithWalk = [
      ...library,
      { id: "walk1", name: "locomotion_walk", file: "mot_walk.vrma" },
    ];
    const slots = {
      idle: ["m1"],
      rest: [],
      walk: ["locomotion_walk.vrma"],
      climb: [],
      in_place: [],
    };
    expect(resolveMotionForSlot("walk", slots, libraryWithWalk)?.file).toBe("mot_walk.vrma");
  });
});

describe("resolveLocomotionMotion", () => {
  test("walk 槽位优先于 manifest 回退", () => {
    const library = [{ id: "w1", name: "Custom Walk", file: "custom_walk.vrma" }];
    const slots = {
      idle: [],
      rest: [],
      walk: ["w1"],
      climb: [],
      in_place: [],
    };
    expect(resolveLocomotionMotion("walk", slots, library)?.file).toBe("custom_walk.vrma");
  });

  test("walk 槽位为空时使用 manifest 默认文件", () => {
    const library = [{ id: "w1", name: "locomotion_walk", file: "mot_walk.vrma" }];
    const slots = { idle: [], rest: [], walk: [], climb: [], in_place: [] };
    expect(resolveLocomotionMotion("walk", slots, library, defaultLocomotion)?.file).toBe(
      "mot_walk.vrma",
    );
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

  test("空 walk 槽位链接 manifest locomotion 到动作库 id", () => {
    const library = [{ id: "w1", name: "locomotion_walk", file: "mot_walk.vrma" }];
    const normalized = normalizeMotionSlots({ walk: [] }, library, defaultLocomotion);
    expect(normalized.walk).toEqual(["w1"]);
  });
});
