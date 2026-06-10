import { describe, it, expect } from "bun:test";
import { getEmailMessage, listAccountMessages, markEmailRead } from "./handlers/email.ts";

describe("email handler", () => {
  it("未知账户 listAccountMessages 返回 ok:false", async () => {
    const result = await listAccountMessages("__nonexistent_account__");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect("code" in result ? result.code : undefined).toBe("email_account_not_found");
      expect(result.error).toContain("Account not found");
    }
  });

  it("未知账户 getEmailMessage 返回 ok:false", async () => {
    const result = await getEmailMessage("__nonexistent_account__", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect("code" in result ? result.code : undefined).toBe("email_account_not_found");
      expect(result.error).toContain("Account not found");
    }
  });

  it("未知账户 markEmailRead 返回 ok:false", async () => {
    const result = await markEmailRead("__nonexistent_account__", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect("code" in result ? result.code : undefined).toBe("email_account_not_found");
      expect(result.error).toContain("Account not found");
    }
  });
});
