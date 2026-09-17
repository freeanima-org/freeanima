import { describe, expect, test } from "bun:test";

import { toServiceApiTokenPublic } from "./types.ts";

describe("toServiceApiTokenPublic", () => {
  test("revealable when token_secret present", () => {
    const publicRow = toServiceApiTokenPublic({
      id: 1,
      subject_id: 2,
      name: "desktop",
      prefix: "abcdefghijkl",
      token_hash: "hash",
      token_secret: "secret",
      authorization: { full: true },
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      expires_at: null,
      last_used_at: null,
      revoked_at: null,
    });
    expect(publicRow.revealable).toBe(true);
    expect(publicRow.authorization).toEqual({ full: true });
    expect(publicRow).not.toHaveProperty("token_secret");
    expect(publicRow).not.toHaveProperty("token_hash");
  });

  test("not revealable when token_secret null", () => {
    const publicRow = toServiceApiTokenPublic({
      id: 1,
      subject_id: 2,
      name: "legacy",
      prefix: "abcdefghijkl",
      token_hash: "hash",
      token_secret: null,
      authorization: { full: true },
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      expires_at: null,
      last_used_at: null,
      revoked_at: null,
    });
    expect(publicRow.revealable).toBe(false);
  });
});
