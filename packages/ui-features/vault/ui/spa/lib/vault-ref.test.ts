import { describe, expect, it } from "bun:test";

import { formatVaultRef, parseVaultRef, vaultRefFieldCandidates } from "./vault-ref.ts";

describe("formatVaultRef / parseVaultRef", () => {
  it("round-trips item id and field", () => {
    const raw = formatVaultRef(12, "password");
    expect(raw).toBe('vault("12", "password")');
    expect(parseVaultRef(raw)).toEqual({ itemId: 12, field: "password" });
  });

  it("accepts optional space after comma", () => {
    expect(parseVaultRef('vault("3","api_token")')).toEqual({
      itemId: 3,
      field: "api_token",
    });
    expect(parseVaultRef('vault("3", "api_token")')).toEqual({
      itemId: 3,
      field: "api_token",
    });
  });

  it("rejects plaintext and env refs", () => {
    expect(parseVaultRef("sk-secret")).toBeNull();
    expect(parseVaultRef('env("OPENAI_API_KEY")')).toBeNull();
    expect(parseVaultRef('vault("0", "password")')).toBeNull();
    expect(parseVaultRef('vault("x", "password")')).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(parseVaultRef('  vault("9", "notes")  ')).toEqual({
      itemId: 9,
      field: "notes",
    });
  });
});

describe("vaultRefFieldCandidates", () => {
  it("includes builtins and custom names", () => {
    expect(
      vaultRefFieldCandidates({
        item_type: "login",
        custom_field_names: ["api_token", "password"],
      }),
    ).toEqual(["password", "notes", "totp", "api_token"]);
  });

  it("adds card nested fields for card items", () => {
    const fields = vaultRefFieldCandidates({
      item_type: "card",
      custom_field_names: [],
    });
    expect(fields).toContain("card.number");
    expect(fields).toContain("card.code");
  });

  it("adds identity nested fields for identity items", () => {
    const fields = vaultRefFieldCandidates({
      item_type: "identity",
      custom_field_names: [],
    });
    expect(fields).toContain("identity.email");
    expect(fields).toContain("identity.username");
  });
});
