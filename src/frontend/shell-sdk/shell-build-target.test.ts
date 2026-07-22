import { afterEach, describe, expect, it } from "bun:test";

import {
  getShellBuildTarget,
  parseShellBuildTarget,
  setShellBuildTargetForTests,
  shellWebDistDirName,
} from "./shell-build-target.ts";

describe("shell-build-target", () => {
  afterEach(() => {
    setShellBuildTargetForTests(null);
  });

  it("parseShellBuildTarget 缺省 web", () => {
    expect(parseShellBuildTarget(undefined)).toBe("web");
    expect(parseShellBuildTarget("")).toBe("web");
    expect(parseShellBuildTarget(" Desktop ")).toBe("desktop");
  });

  it("parseShellBuildTarget 非法值抛错", () => {
    expect(() => parseShellBuildTarget("browser")).toThrow(/FREEANIMA_SHELL_TARGET/);
  });

  it("shellWebDistDirName 分目录", () => {
    expect(shellWebDistDirName("web")).toBe("dist");
    expect(shellWebDistDirName("desktop")).toBe("dist-desktop");
    expect(shellWebDistDirName("mobile")).toBe("dist-mobile");
  });

  it("getShellBuildTarget 可读测试覆盖", () => {
    expect(getShellBuildTarget()).toBe("web");
    setShellBuildTargetForTests("desktop");
    expect(getShellBuildTarget()).toBe("desktop");
  });
});
