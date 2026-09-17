import { describe, expect, it } from "bun:test";

import { codingNoteBodySchema } from "./coding-note.ts";

describe("codingNoteBodySchema", () => {
  it("accepts empty body", () => {
    const parsed = codingNoteBodySchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it("accepts optional kind", () => {
    const parsed = codingNoteBodySchema.safeParse({ kind: "  explore  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.kind).toBe("explore");
  });

  it("rejects empty kind", () => {
    expect(codingNoteBodySchema.safeParse({ kind: "  " }).success).toBe(false);
  });
});
