import { afterEach, describe, expect, it } from "bun:test";
import { Config } from "@freeanima/service-config";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema, type AnimaConfig } from "@freeanima/service-config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import {
  bindEmailAccountsConfig,
  resetEmailAccountsConfigForTest,
  deleteEmailAccount,
  editEmailAccount,
  getDefaultSender,
  listEmailAccounts,
  registerEmailAccount,
  resolveAccount,
} from "./email/accounts.ts";
import type { EmailAccount } from "./email/types.ts";

const sampleAccount: EmailAccount = {
  id: "main-inbox",
  password: 'credential("email/example", "password")',
  address: "you@example.com",
  display_name: "Example User",
  smtp_host: "smtp.example.com",
  smtp_port: 465,
  imap_host: "imap.example.com",
  imap_port: 993,
  default_sender: true,
  enabled: true,
};

function emptyConfig(): AnimaConfig {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

function withEmailAccounts(accounts: EmailAccount[]): Config {
  return Config.fromSnapshot({ ...emptyConfig(), email: { accounts } });
}

describe("email accounts", () => {
  afterEach(() => {
    resetEmailAccountsConfigForTest();
  });

  it("listEmailAccounts returns password references", () => {
    bindEmailAccountsConfig(withEmailAccounts([sampleAccount]));
    const accounts = listEmailAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.password).toBe('credential("email/example", "password")');
  });

  it("editEmailAccount updates fields and handles default_sender exclusivity", () => {
    bindEmailAccountsConfig(
      withEmailAccounts([
        sampleAccount,
        {
          ...sampleAccount,
          id: "backup-inbox",
          password: 'credential("email/backup", "token")',
          address: "backup@example.com",
          default_sender: false,
        },
      ]),
    );

    editEmailAccount("backup-inbox", { default_sender: true });
    const accounts = listEmailAccounts();
    const primary = accounts.find((a) => a.id === "main-inbox");
    const secondary = accounts.find((a) => a.id === "backup-inbox");
    expect(primary?.default_sender).toBe(false);
    expect(secondary?.default_sender).toBe(true);
  });

  it("deleteEmailAccount removes account", () => {
    bindEmailAccountsConfig(withEmailAccounts([sampleAccount]));
    deleteEmailAccount("main-inbox");
    expect(listEmailAccounts()).toHaveLength(0);
  });

  it("getDefaultSender and resolveAccount", () => {
    bindEmailAccountsConfig(withEmailAccounts([sampleAccount]));
    expect(getDefaultSender()?.id).toBe("main-inbox");
    expect(resolveAccount().id).toBe("main-inbox");
    expect(resolveAccount("main-inbox").address).toBe("you@example.com");
  });

  it("registerEmailAccount throws when pass entry is missing", async () => {
    bindEmailAccountsConfig(withEmailAccounts([]));
    await expect(
      registerEmailAccount({
        ...sampleAccount,
        password: 'credential("email/missing", "password")',
      }),
    ).rejects.toThrow(/could not be resolved/);
  });
});
