import { describe, expect, it } from "bun:test";

import { worldConfigBodySchema } from "./world-config.ts";

describe("worldConfigBodySchema", () => {
  it("accepts public world with empty body", () => {
    const parsed = worldConfigBodySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.private).toBe(false);
      expect(parsed.data.owner_subject_id).toBeUndefined();
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
});
