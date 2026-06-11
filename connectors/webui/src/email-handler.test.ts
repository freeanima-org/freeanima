import { afterEach, beforeEach, describe, it, expect } from "bun:test";
import { Config } from "@freeanima/service-config";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import { bindEmailAccountsConfig, resetEmailAccountsConfigForTest } from "@freeanima/life-estate";
import { getEmailMessage, listAccountMessages, markEmailRead } from "./handlers/email.ts";

function emptyEmailConfig(): Config {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return Config.fromSnapshot({ ...parsed.data, email: { accounts: [] } });
}

describe("email handler", () => {
  afterEach(() => {
    resetEmailAccountsConfigForTest();
  });

  beforeEach(() => {
    bindEmailAccountsConfig(emptyEmailConfig());
  });
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
