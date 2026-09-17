import { describe, expect, test } from "bun:test";

import {
  applyProviderPreset,
  assertCompleteEmailHosts,
  EMAIL_PROVIDER_PRESETS,
  listEmailProviderPresets,
  requireCompleteEmailHosts,
} from "./provider-presets.ts";

describe("applyProviderPreset", () => {
  test("fills hosts from gmail provider", () => {
    const out = applyProviderPreset({ provider: "gmail" });
    expect(out).toMatchObject({
      provider: "gmail",
      imap_host: EMAIL_PROVIDER_PRESETS.gmail.imap_host,
      imap_port: EMAIL_PROVIDER_PRESETS.gmail.imap_port,
      smtp_host: EMAIL_PROVIDER_PRESETS.gmail.smtp_host,
      smtp_port: EMAIL_PROVIDER_PRESETS.gmail.smtp_port,
    });
  });

  test("fills hosts from qq and aliyun", () => {
    expect(applyProviderPreset({ provider: "qq" })).toMatchObject({
      provider: "qq",
      imap_host: EMAIL_PROVIDER_PRESETS.qq.imap_host,
      smtp_host: EMAIL_PROVIDER_PRESETS.qq.smtp_host,
    });
    expect(applyProviderPreset({ provider: "aliyun" })).toMatchObject({
      provider: "aliyun",
      imap_host: EMAIL_PROVIDER_PRESETS.aliyun.imap_host,
      smtp_host: EMAIL_PROVIDER_PRESETS.aliyun.smtp_host,
    });
  });

  test("explicit host/port override preset", () => {
    const out = applyProviderPreset({
      provider: "gmail" as const,
      smtp_host: "smtp.custom.example",
      smtp_port: 2525,
      imap_host: "imap.custom.example",
      imap_port: undefined as number | undefined,
    });
    expect(out.smtp_host).toBe("smtp.custom.example");
    expect(out.smtp_port).toBe(2525);
    expect(out.imap_host).toBe("imap.custom.example");
    expect(out.imap_port).toBe(EMAIL_PROVIDER_PRESETS.gmail.imap_port);
  });

  test("custom or missing provider fills nothing", () => {
    expect(applyProviderPreset({ provider: "custom" })).toEqual({ provider: "custom" });
    expect(applyProviderPreset({})).toEqual({});
  });
});

describe("assertCompleteEmailHosts", () => {
  test("accepts complete hosts", () => {
    expect(
      requireCompleteEmailHosts({
        smtp_host: "smtp.example.com",
        smtp_port: 465,
        imap_host: "imap.example.com",
        imap_port: 993,
      }),
    ).toEqual({
      smtp_host: "smtp.example.com",
      smtp_port: 465,
      imap_host: "imap.example.com",
      imap_port: 993,
    });
  });

  test("rejects missing fields without provider fill", () => {
    expect(() => requireCompleteEmailHosts({})).toThrow(/Missing IMAP\/SMTP/);
    expect(() => assertCompleteEmailHosts({})).toThrow(/Missing IMAP\/SMTP/);
  });
});

describe("listEmailProviderPresets", () => {
  test("returns named presets only", () => {
    const list = listEmailProviderPresets();
    expect(list.map((p) => p.id).toSorted()).toEqual(["aliyun", "gmail", "qq"]);
  });
});
