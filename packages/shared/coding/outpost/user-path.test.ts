import { describe, expect, it } from "bun:test";

import { mergeUserPath, pathSeparator, userBinCandidates, USER_BIN_REL_DIRS } from "./user-path.ts";

const existsAll = () => true;
const existsNone = () => false;

describe("userBinCandidates", () => {
  it("展开 $HOME 下的候选目录（unix）", () => {
    expect(userBinCandidates("/home/u", "linux")).toEqual(
      USER_BIN_REL_DIRS.map((rel) => `/home/u/${rel}`),
    );
  });

  it("Windows 用反斜杠分隔", () => {
    expect(userBinCandidates("C:\\Users\\u", "win32")[0]).toBe("C:\\Users\\u\\.local\\bin");
  });

  it("无 HOME 时返回空", () => {
    expect(userBinCandidates(null, "linux")).toEqual([]);
    expect(userBinCandidates("", "linux")).toEqual([]);
  });
});

describe("pathSeparator", () => {
  it("unix 冒号 / windows 分号", () => {
    expect(pathSeparator("linux")).toBe(":");
    expect(pathSeparator("win32")).toBe(";");
  });
});

describe("mergeUserPath", () => {
  it("存在才前置，保持既有顺序", () => {
    const out = mergeUserPath("/usr/bin:/bin", {
      home: "/home/u",
      exists: (d) => d === "/home/u/.local/bin" || d === "/home/u/.bun/bin",
      platform: "linux",
    });
    expect(out).toBe("/home/u/.local/bin:/home/u/.bun/bin:/usr/bin:/bin");
  });

  it("已存在于 PATH 的不重复加入", () => {
    const out = mergeUserPath("/home/u/.bun/bin:/usr/bin", {
      home: "/home/u",
      exists: existsAll,
      platform: "linux",
    });
    expect(out).toBe(
      "/home/u/.local/bin:/home/u/.cargo/bin:/home/u/go/bin:/home/u/.npm-global/bin:/home/u/.yarn/bin:/home/u/bin:/home/u/.bun/bin:/usr/bin",
    );
  });

  it("候选目录都不存在时 PATH 原样", () => {
    const out = mergeUserPath("/usr/bin:/bin", {
      home: "/home/u",
      exists: existsNone,
      platform: "linux",
    });
    expect(out).toBe("/usr/bin:/bin");
  });

  it("空 PATH / 无 HOME 不崩", () => {
    expect(mergeUserPath(null, { home: null, exists: existsAll, platform: "linux" })).toBe("");
    expect(mergeUserPath("", { home: "/home/u", exists: existsAll, platform: "linux" })).toBe(
      USER_BIN_REL_DIRS.map((rel) => `/home/u/${rel}`).join(":"),
    );
  });

  it("Windows 分隔符与候选", () => {
    const out = mergeUserPath("C:\\Windows\\System32", {
      home: "C:\\Users\\u",
      exists: existsAll,
      platform: "win32",
    });
    expect(out).toContain("C:\\Users\\u\\.cargo\\bin");
    expect(out).toContain("C:\\Windows\\System32");
  });
});
