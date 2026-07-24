import { describe, expect, it } from "bun:test";

import { normalizeWorldGrants, worldConfigBodySchema } from "./world-config.ts";

describe("worldConfigBodySchema", () => {
  it("accepts public world with empty body", () => {
    const parsed = worldConfigBodySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.private).toBe(false);
      expect(parsed.data.owner_subject_id).toBeUndefined();
      expect(parsed.data.grants).toEqual([]);
    }
  });

  it("accepts private world with owner_subject_id", () => {
    const parsed = worldConfigBodySchema.safeParse({
      private: true,
      owner_subject_id: 42,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects private world without owner_subject_id", () => {
    const parsed = worldConfigBodySchema.safeParse({ private: true });
    expect(parsed.success).toBe(false);
  });

  it("rejects public world with owner_subject_id", () => {
    const parsed = worldConfigBodySchema.safeParse({
      private: false,
      owner_subject_id: 42,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts default private world", () => {
    const parsed = worldConfigBodySchema.safeParse({
      private: true,
      owner_subject_id: 42,
      default_private: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects default private world without owner", () => {
    const parsed = worldConfigBodySchema.safeParse({
      private: true,
      default_private: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts grants on private world", () => {
    const parsed = worldConfigBodySchema.safeParse({
      private: true,
      owner_subject_id: 42,
      grants: [{ subject_id: 109, permission: "write" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts write grants on public world", () => {
    const parsed = worldConfigBodySchema.safeParse({
      private: false,
      grants: [{ subject_id: 109, permission: "write" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects duplicate grant subject_id", () => {
    const parsed = worldConfigBodySchema.safeParse({
      private: true,
      owner_subject_id: 42,
      grants: [
        { subject_id: 109, permission: "read" },
        { subject_id: 109, permission: "write" },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects grant equal to owner_subject_id", () => {
    const parsed = worldConfigBodySchema.safeParse({
      private: true,
      owner_subject_id: 42,
      grants: [{ subject_id: 42, permission: "read" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("normalizeWorldGrants", () => {
  it("strips owner and dedupes last-wins", () => {
    expect(
      normalizeWorldGrants(
        [
          { subject_id: 1, permission: "read" },
          { subject_id: 2, permission: "read" },
          { subject_id: 2, permission: "write" },
          { subject_id: 9, permission: "write" },
        ],
        9,
      ),
    ).toEqual([
      { subject_id: 1, permission: "read" },
      { subject_id: 2, permission: "write" },
    ]);
  });
});
