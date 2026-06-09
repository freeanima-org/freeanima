import { describe, expect, it } from "bun:test";
import { checkCredential, checkTool } from "./filter.ts";
import type { ResolvedMask } from "./types.ts";

const resolved: ResolvedMask = {
  allowed_tools: ["memory_recall", "file_read_file"],
  denied_tools: ["file_write_file"],
  auto_skills: [],
  credentials: [{ name: "api_key", read: "deny", write: "allow" }],
};

describe("checkTool", () => {
  it("allowed 工具通过", () => {
    expect(checkTool("memory_recall", resolved)).toEqual({ ok: true });
  });

  it("未允许工具拒绝", () => {
    const r = checkTool("code_execute", resolved);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("code_execute");
  });
});

describe("checkCredential", () => {
  it("未提及凭证默认允许", () => {
    expect(checkCredential("other", "read", resolved)).toEqual({ ok: true });
  });

  it("deny read 拦截", () => {
    const r = checkCredential("api_key", "read", resolved);
    expect(r.ok).toBe(false);
  });

  it("allow write 通过", () => {
    expect(checkCredential("api_key", "write", resolved)).toEqual({ ok: true });
  });
});
