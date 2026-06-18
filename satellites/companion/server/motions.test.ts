import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { requiredMotionFiles } from "../shared/motion-manifest.ts";
import { motionsReady, REQUIRED_MOTION_FILES, resolveMotionFile } from "./motions.ts";

describe("motionsReady", () => {
  test("空目录返回 false", () => {
    expect(motionsReady("/nonexistent-dir-for-test")).toBe(false);
  });

  test("识别 motions/vrma/ 子目录布局（官方 zip 默认结构）", () => {
    const dir = mkdtempSync(join(tmpdir(), "companion-motions-"));
    try {
      const nested = join(dir, "vrma");
      mkdirSync(nested, { recursive: true });
      for (const name of REQUIRED_MOTION_FILES) {
        writeFileSync(join(nested, name), "x");
      }
      expect(motionsReady(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("识别展平后的根目录布局", () => {
    const dir = mkdtempSync(join(tmpdir(), "companion-motions-flat-"));
    try {
      for (const name of REQUIRED_MOTION_FILES) {
        writeFileSync(join(dir, name), "x");
      }
      expect(motionsReady(dir)).toBe(true);
      expect(existsSync(join(dir, "vrma"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("resolveMotionFile", () => {
  test("拒绝非 .vrma 路径", () => {
    expect(resolveMotionFile("/motions/readme.txt")).toBeNull();
  });

  test("仅接受 basename", () => {
    expect(resolveMotionFile("/motions/../../etc/passwd")).toBeNull();
    expect(basename("../../etc/passwd")).not.toMatch(/\.vrma$/);
  });

  test("解码 URL 编码的文件名", () => {
    const dir = mkdtempSync(join(tmpdir(), "companion-motion-url-"));
    try {
      writeFileSync(join(dir, "Happy Walk.vrma"), "x");
      const prev = process.env.FREEANIMA_HOME;
      process.env.FREEANIMA_HOME = join(dir, "home");
      mkdirSync(join(process.env.FREEANIMA_HOME, "companion", "motions"), { recursive: true });
      const motionDir = join(process.env.FREEANIMA_HOME, "companion", "motions");
      writeFileSync(join(motionDir, "Happy Walk.vrma"), "x");
      expect(resolveMotionFile("/motions/Happy%20Walk.vrma")).toBe(
        join(motionDir, "Happy Walk.vrma"),
      );
      if (prev === undefined) delete process.env.FREEANIMA_HOME;
      else process.env.FREEANIMA_HOME = prev;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("REQUIRED_MOTION_FILES", () => {
  test("与 motion-manifest 一致", () => {
    expect([...REQUIRED_MOTION_FILES].sort()).toEqual([...requiredMotionFiles()].sort());
  });
});
