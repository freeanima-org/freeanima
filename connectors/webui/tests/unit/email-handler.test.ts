import { describe, it, expect } from "bun:test";
import { getEmailMessage, listAccountMessages, markEmailRead } from "../../src/handlers/email.ts";

describe("email handler", () => {
  it("未知账户 listAccountMessages 返回 ok:false", async () => {
    const result = await listAccountMessages("__nonexistent_account__");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("未找到账户");
  });

  it("未知账户 getEmailMessage 返回 ok:false", async () => {
    const result = await getEmailMessage("__nonexistent_account__", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("未找到账户");
  });

  it("未知账户 markEmailRead 返回 ok:false", async () => {
    const result = await markEmailRead("__nonexistent_account__", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("未找到账户");
  });
});
