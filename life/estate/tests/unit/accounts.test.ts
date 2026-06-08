import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { patchConfigSection } from "@freeanima/service-config";

import {
  beginMinimalConfigHome,
  endMinimalConfigHome,
} from "../../../../tests/helpers/minimal-config-home.ts";
import {
  deleteEmailAccount,
  editEmailAccount,
  getDefaultSender,
  listEmailAccounts,
  registerEmailAccount,
  resolveAccount,
} from "../../src/email/accounts.ts";

const sampleAccount = {
  id: "feng-fengtrace",
  password: 'credential("email/feng-fengtrace", "password")',
  address: "feng@fengtrace.com",
  display_name: "Feng",
  smtp_host: "smtp.example.com",
  smtp_port: 465,
  imap_host: "imap.example.com",
  imap_port: 993,
  default_sender: true,
  enabled: true,
};

describe("email accounts", () => {
  let prevHome: string | undefined;

  beforeEach(() => {
    ({ prevHome } = beginMinimalConfigHome("anima-estate-email-"));
  });

  afterEach(() => {
    endMinimalConfigHome(prevHome);
  });

  it("listEmailAccounts 返回 password 引用", () => {
    patchConfigSection("email", { accounts: [sampleAccount] });
    const accounts = listEmailAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.password).toBe('credential("email/feng-fengtrace", "password")');
  });

  it("editEmailAccount 更新字段并处理 default_sender 互斥", () => {
    patchConfigSection("email", {
      accounts: [
        sampleAccount,
        {
          ...sampleAccount,
          id: "feng.grass.show",
          password: 'credential("email/feng.grass.show", "token")',
          address: "feng@grass.show",
          default_sender: false,
        },
      ],
    });

    editEmailAccount("feng.grass.show", { default_sender: true });
    const accounts = listEmailAccounts();
    const primary = accounts.find((a) => a.id === "feng-fengtrace");
    const secondary = accounts.find((a) => a.id === "feng.grass.show");
    expect(primary?.default_sender).toBe(false);
    expect(secondary?.default_sender).toBe(true);
  });

  it("deleteEmailAccount 删除账户", () => {
    patchConfigSection("email", { accounts: [sampleAccount] });
    deleteEmailAccount("feng-fengtrace");
    expect(listEmailAccounts()).toHaveLength(0);
  });

  it("getDefaultSender 与 resolveAccount", () => {
    patchConfigSection("email", { accounts: [sampleAccount] });
    expect(getDefaultSender()?.id).toBe("feng-fengtrace");
    expect(resolveAccount().id).toBe("feng-fengtrace");
    expect(resolveAccount("feng-fengtrace").address).toBe("feng@fengtrace.com");
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
