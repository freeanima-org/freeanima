import { describe, expect, it } from "bun:test";

import {
  diffVaultRevisionFields,
  vaultCompareViewFromEntity,
  type VaultRevisionCompareView,
} from "./revision-diff.ts";

function view(partial: Partial<VaultRevisionCompareView>): VaultRevisionCompareView {
  return {
    title: "t",
    content: "",
    tags: [],
    custom_field_names: [],
    ...partial,
  };
}

describe("diffVaultRevisionFields", () => {
  it("detects username-only change", () => {
    const older = view({ username: "grass" });
    const newer = view({ username: "grass123" });
    expect(diffVaultRevisionFields(older, newer)).toEqual(["username"]);
  });

  it("detects secrets-only change", () => {
    const older = view({ secrets_enc: "a" });
    const newer = view({ secrets_enc: "b" });
    expect(diffVaultRevisionFields(older, newer)).toEqual(["secrets"]);
  });

  it("detects multiple fields", () => {
    const older = view({ title: "old", username: "u1", secrets_enc: "s1" });
    const newer = view({ title: "new", username: "u2", secrets_enc: "s2" });
    expect(diffVaultRevisionFields(older, newer)).toEqual(["title", "username", "secrets"]);
  });

  it("returns empty when equal", () => {
    const a = view({ title: "x", url: "https://a", tags: ["a", "b"] });
    const b = vaultCompareViewFromEntity({
      title: "x",
      content: "",
      body: { url: "https://a", tags: ["b", "a"] },
    });
    expect(diffVaultRevisionFields(a, b)).toEqual([]);
  });
});
