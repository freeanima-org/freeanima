import { describe, it, expect } from "bun:test";
import { mergeCredentialData } from "./credential.ts";

describe("mergeCredentialData", () => {
  it("保留未提及字段", () => {
    expect(
      mergeCredentialData(
        { url: "https://example.com", desc: "old", tags: "dev" },
        { desc: "new" },
      ),
    ).toEqual({
      url: "https://example.com",
      desc: "new",
      tags: "dev",
    });
  });

  it("可新增字段", () => {
    expect(mergeCredentialData({ token: "abc" }, { npmtoken: "npm_xxx" })).toEqual({
      token: "abc",
      npmtoken: "npm_xxx",
    });
  });

  it("patch 覆盖同名字段", () => {
    expect(mergeCredentialData({ token: "old" }, { token: "new" })).toEqual({ token: "new" });
  });
});
