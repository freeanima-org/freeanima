import { describe, expect, it } from "bun:test";
import { checkCredential, checkTool } from "../../src/filter.ts";
import type { ResolvedMask } from "../../src/types.ts";

const resolved: ResolvedMask = {
  allowed_tools: ["recall", "read_file"],
  denied_tools: ["write_file"],
  auto_skills: [],
  credentials: [{ name: "api_key", read: "deny", write: "allow" }],
};

describe("checkTool", () => {
  it("allowed 工具通过", () => {
    expect(checkTool("recall", resolved)).toEqual({ ok: true });
  });

  it("未允许工具拒绝", () => {
    const r = checkTool("execute_code", resolved);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("execute_code");
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
