import { afterEach, describe, expect, it } from "bun:test";

import {
  normalizeShellModulePrimaryCount,
  readShellModulePrimaryCount,
  resetShellModulePrimaryCountForTest,
  writeShellModulePrimaryCount,
} from "./shell-module-primary-count.ts";

afterEach(() => {
  resetShellModulePrimaryCountForTest();
});

describe("normalizeShellModulePrimaryCount", () => {
  it("空值返回 null", () => {
    expect(normalizeShellModulePrimaryCount(null)).toBeNull();
    expect(normalizeShellModulePrimaryCount(undefined)).toBeNull();
    expect(normalizeShellModulePrimaryCount("")).toBeNull();
  });

  it("小于 1 返回 null", () => {
    expect(normalizeShellModulePrimaryCount(0)).toBeNull();
    expect(normalizeShellModulePrimaryCount(-2)).toBeNull();
  });

  it("取整正整数", () => {
    expect(normalizeShellModulePrimaryCount(3.9)).toBe(3);
    expect(normalizeShellModulePrimaryCount("5")).toBe(5);
  });
});

describe("readShellModulePrimaryCount / writeShellModulePrimaryCount", () => {
  it("未写入时为 null", () => {
    expect(readShellModulePrimaryCount()).toBeNull();
  });

  it("round-trip 持久化", () => {
    writeShellModulePrimaryCount(4);
    expect(readShellModulePrimaryCount()).toBe(4);
  });

  it("写 null 清除", () => {
    writeShellModulePrimaryCount(3);
    writeShellModulePrimaryCount(null);
    expect(readShellModulePrimaryCount()).toBeNull();
  });
});
