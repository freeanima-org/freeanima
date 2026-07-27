import { describe, expect, it } from "bun:test";
import {
  normalizeMotionSlots,
  resolveLocomotionMotion,
  resolveMotionForSlot,
} from "./motion-slot-resolve.ts";
import type { MotionLibraryEntry, MotionSlotsConfig } from "./types.ts";

const library: MotionLibraryEntry[] = [
  { name: "Idle A", object_file_id: 1, sort: 0 },
  { name: "Idle B", object_file_id: 2, sort: 1 },
  { name: "Walk", object_file_id: 3, sort: 2 },
];

describe("resolveMotionForSlot", () => {
  const slots: MotionSlotsConfig = {
    idle: [1, 2],
    rest: [],
    walk: [],
    climb: [],
    in_place: [],
  };

  it("honors explicit object_file_id", () => {
    expect(resolveMotionForSlot("idle", slots, library, { motionId: 2 })?.objectFileId).toBe(2);
    expect(resolveMotionForSlot("idle", slots, library, { motionId: 2 })?.file).toBe(
      "/motions/2.vrma",
    );
  });

  it("returns null for missing explicit id", () => {
    expect(resolveMotionForSlot("idle", slots, library, { motionId: 99 })).toBeNull();
  });

  it("returns null when slot empty", () => {
    expect(resolveMotionForSlot("walk", slots, library)).toBeNull();
  });

  it("picks from slot bindings", () => {
    const libraryWithWalk: MotionLibraryEntry[] = [
      ...library,
      { name: "W", object_file_id: 10, sort: 3 },
    ];
    const walkSlots: MotionSlotsConfig = { ...slots, walk: [10] };
    expect(resolveMotionForSlot("walk", walkSlots, libraryWithWalk)?.file).toBe("/motions/10.vrma");
  });
});

describe("resolveLocomotionMotion", () => {
  it("uses slot binding first", () => {
    const slots: MotionSlotsConfig = {
      idle: [],
      rest: [],
      walk: [3],
      climb: [],
      in_place: [],
    };
    expect(resolveLocomotionMotion("walk", slots, library)?.file).toBe("/motions/3.vrma");
  });

  it("falls back to manifest file name", () => {
    const slots: MotionSlotsConfig = {
      idle: [],
      rest: [],
      walk: [],
      climb: [],
      in_place: [],
    };
    expect(
      resolveLocomotionMotion("walk", slots, library, { walk: "builtin_walk.vrma" })?.file,
    ).toBe("builtin_walk.vrma");
  });
});

describe("normalizeMotionSlots", () => {
  it("maps numeric refs", () => {
    const normalized = normalizeMotionSlots({ idle: [1, 2], walk: ["3"] }, library);
    expect(normalized.idle).toEqual([1, 2]);
    expect(normalized.walk).toEqual([3]);
  });

  it("keeps empty walk", () => {
    const normalized = normalizeMotionSlots({ walk: [] }, library);
    expect(normalized.walk).toEqual([]);
  });
});
