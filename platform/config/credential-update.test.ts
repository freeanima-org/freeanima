import { describe, it, expect } from "bun:test";
import { mergeCredentialData } from "./credential.ts";

describe("mergeCredentialData", () => {
  it("preserves unmentioned fields", () => {
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

  it("can add new fields", () => {
    expect(mergeCredentialData({ token: "abc" }, { npmtoken: "npm_xxx" })).toEqual({
      token: "abc",
      npmtoken: "npm_xxx",
    });
  });

  it("patch overwrites same-named fields", () => {
    expect(mergeCredentialData({ token: "old" }, { token: "new" })).toEqual({ token: "new" });
  });
});
