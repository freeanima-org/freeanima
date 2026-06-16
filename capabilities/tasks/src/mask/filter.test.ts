import { describe, expect, it } from "bun:test";
import { checkCredential, checkTool } from "./filter.ts";
import type { ResolvedMask } from "./types.ts";

const resolved: ResolvedMask = {
  allowed_tools: ["memory_recall", "file_read"],
  denied_tools: ["file_write"],
  auto_skills: [],
  credentials: [{ name: "api_key", read: "deny", write: "allow" }],
};

describe("checkTool", () => {
  it("allowed tools pass", () => {
    expect(checkTool("memory_recall", resolved)).toEqual({ ok: true });
  });

  it("disallowed tools rejected", () => {
    const r = checkTool("code_execute", resolved);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("code_execute");
  });
});

describe("checkCredential", () => {
  it("credentials not mentioned allowed by default", () => {
    expect(checkCredential("other", "read", resolved)).toEqual({ ok: true });
  });

  it("deny read blocks", () => {
    const r = checkCredential("api_key", "read", resolved);
    expect(r.ok).toBe(false);
  });

  it("allow write passes", () => {
    expect(checkCredential("api_key", "write", resolved)).toEqual({ ok: true });
  });
});
