import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as serviceConfig from "@freeanima/service-config";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema, type AnimaConfig } from "@freeanima/service-config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import {
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

describe("email accounts", () => {
  let config: AnimaConfig;
  let patchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    config = emptyConfig();
    serviceConfig.setConfigForTest(config);
    patchSpy = spyOn(serviceConfig, "patchConfigSection").mockImplementation(
      (section: string, patch: Record<string, unknown>) => {
        const key = section as keyof AnimaConfig;
        const existing = config[key];
        const base =
          typeof existing === "object" && existing !== null && !Array.isArray(existing)
            ? (existing as Record<string, unknown>)
            : {};
        config = { ...config, [key]: { ...base, ...patch } } as AnimaConfig;
        serviceConfig.setConfigForTest(config);
      },
    );
  });

  afterEach(() => {
    patchSpy.mockRestore();
    serviceConfig.resetConfigForTest();
  });

  it("listEmailAccounts 返回 password 引用", () => {
    serviceConfig.patchConfigSection("email", { accounts: [sampleAccount] });
    const accounts = listEmailAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.password).toBe('credential("email/example", "password")');
  });

  it("editEmailAccount 更新字段并处理 default_sender 互斥", () => {
    serviceConfig.patchConfigSection("email", {
      accounts: [
        sampleAccount,
        {
          ...sampleAccount,
          id: "backup-inbox",
          password: 'credential("email/backup", "token")',
          address: "backup@example.com",
          default_sender: false,
        },
      ],
    });

    editEmailAccount("backup-inbox", { default_sender: true });
    const accounts = listEmailAccounts();
    const primary = accounts.find((a) => a.id === "main-inbox");
    const secondary = accounts.find((a) => a.id === "backup-inbox");
    expect(primary?.default_sender).toBe(false);
    expect(secondary?.default_sender).toBe(true);
  });

  it("deleteEmailAccount 删除账户", () => {
    serviceConfig.patchConfigSection("email", { accounts: [sampleAccount] });
    deleteEmailAccount("main-inbox");
    expect(listEmailAccounts()).toHaveLength(0);
  });

  it("getDefaultSender 与 resolveAccount", () => {
    serviceConfig.patchConfigSection("email", { accounts: [sampleAccount] });
    expect(getDefaultSender()?.id).toBe("main-inbox");
    expect(resolveAccount().id).toBe("main-inbox");
    expect(resolveAccount("main-inbox").address).toBe("you@example.com");
  });

  it("registerEmailAccount 在 pass 缺失时报错", async () => {
    await expect(
      registerEmailAccount({
        ...sampleAccount,
        id: "test-nonexistent-account-xyz",
        password: 'credential("email/test-nonexistent-account-xyz", "password")',
      }),
    ).rejects.toThrow(/邮件密码无法解析/);
  });
});
