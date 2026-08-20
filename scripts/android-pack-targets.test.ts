import { describe, expect, test } from "bun:test";

import {
  ANDROID_ABI_SHORT,
  resolveAndroidPackAbis,
  rustTargetsForAbis,
  tauriAndroidTargetArgs,
} from "./android-pack-targets.ts";

describe("resolveAndroidPackAbis", () => {
  test("缺省 / 空 → 仅 aarch64", () => {
    expect(resolveAndroidPackAbis({})).toEqual(["aarch64"]);
    expect(resolveAndroidPackAbis({ FREEANIMA_ANDROID_TARGETS: "" })).toEqual(["aarch64"]);
    expect(resolveAndroidPackAbis({ FREEANIMA_ANDROID_TARGETS: "  " })).toEqual(["aarch64"]);
  });

  test("all → 四 ABI", () => {
    expect(resolveAndroidPackAbis({ FREEANIMA_ANDROID_TARGETS: "all" })).toEqual([
      ...ANDROID_ABI_SHORT,
    ]);
  });

  test("逗号列表去重保序", () => {
    expect(
      resolveAndroidPackAbis({ FREEANIMA_ANDROID_TARGETS: "aarch64, x86_64, aarch64" }),
    ).toEqual(["aarch64", "x86_64"]);
  });

  test("非法项抛错", () => {
    expect(() => resolveAndroidPackAbis({ FREEANIMA_ANDROID_TARGETS: "mips" })).toThrow(
      /未知 FREEANIMA_ANDROID_TARGETS/,
    );
  });
});

describe("rust / tauri args", () => {
  test("rustTargetsForAbis", () => {
    expect(rustTargetsForAbis(["aarch64", "armv7"])).toEqual([
      "aarch64-linux-android",
      "armv7-linux-androideabi",
    ]);
  });

  test("tauriAndroidTargetArgs", () => {
    expect(tauriAndroidTargetArgs(["aarch64"])).toEqual(["--target", "aarch64"]);
    expect(tauriAndroidTargetArgs(["aarch64", "x86_64"])).toEqual([
      "--target",
      "aarch64",
      "--target",
      "x86_64",
    ]);
  });
});
