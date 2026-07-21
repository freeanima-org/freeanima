import { describe, expect, it } from "bun:test";

import {
  formatRemotePlatform,
  formatRemoteToolName,
  formatRemoteToolNameAlias,
  isRemotePlatform,
  isRemotePrefixedToolName,
  isValidRemoteInstanceId,
  normalizeAppSlug,
  normalizeInstanceId,
  parseRemotePlatform,
  parseRemoteToolName,
  resolveDefaultRemotePlatform,
} from "./naming.ts";
import { assertRemoteInstanceId, generateRemoteInstanceIdCandidate } from "./instance-id.ts";

describe("remote tools naming", () => {
  const appId = "pair-programming";
  const instanceId = "k7m";

  it("normalizes app slug and instance id", () => {
    expect(normalizeAppSlug("pair-programming")).toBe("pairprogramming");
    expect(normalizeInstanceId(instanceId)).toBe("k7m");
  });

  it("formats remote platform three segments", () => {
    expect(formatRemotePlatform("companion", "k7m")).toBe("remote:companion:k7m");
    expect(isRemotePlatform("remote:companion:k7m")).toBe(true);
    expect(isRemotePlatform("sap:companion:k7m")).toBe(true);
    const parsed = parseRemotePlatform("remote:companion:k7m");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.app_slug).toBe("companion");
      expect(parsed.value.instance_id_norm).toBe("k7m");
    }
  });

  it("resolveDefaultRemotePlatform skips empty REST ctx", () => {
    expect(resolveDefaultRemotePlatform(undefined, "", "")).toBeUndefined();
    expect(resolveDefaultRemotePlatform(undefined, "  ", "")).toBeUndefined();
    expect(resolveDefaultRemotePlatform(undefined, "companion", "k7m")).toBe(
      "remote:companion:k7m",
    );
    expect(resolveDefaultRemotePlatform("chat", "", "")).toBe("chat");
    expect(resolveDefaultRemotePlatform("  ", "companion", "k7m")).toBeUndefined();
  });

  it("validates hub instance ids", () => {
    expect(isValidRemoteInstanceId("k7m")).toBe(true);
    expect(isValidRemoteInstanceId("ab")).toBe(false);
    expect(isValidRemoteInstanceId("uuid")).toBe(false);
    expect(assertRemoteInstanceId("K7M")).toBe("k7m");
    expect(generateRemoteInstanceIdCandidate()).toMatch(/^[a-z0-9]{3}$/);
  });

  it("formats canonical and alias tool names with short instance id", () => {
    expect(formatRemoteToolName(appId, instanceId, "scan_code")).toBe(
      "remote_pairprogramming_k7m_scan_code",
    );
    expect(formatRemoteToolNameAlias(appId, instanceId, "file_read")).toBe(
      "remote:pairprogramming:k7m:file_read",
    );
  });

  it("parses canonical names with underscores in local_name", () => {
    const name = formatRemoteToolName(appId, instanceId, "file_read");
    const parsed = parseRemoteToolName(name);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.local_name).toBe("file_read");
      expect(parsed.value.app_slug).toBe("pairprogramming");
      expect(parsed.value.instance_id_norm).toBe("k7m");
    }
  });

  it("parses legacy sap_ / sap: names", () => {
    const legacy = parseRemoteToolName("sap_companion_k7m_bubble");
    expect(legacy.ok).toBe(true);
    if (legacy.ok) {
      expect(legacy.value.canonical).toBe("remote_companion_k7m_bubble");
    }
    expect(parseRemoteToolName("sap:companion:k7m:bubble").ok).toBe(true);
  });

  it("parses alias names", () => {
    const alias = formatRemoteToolNameAlias(appId, instanceId, "scan_code");
    expect(isRemotePrefixedToolName(alias)).toBe(true);
    const parsed = parseRemoteToolName(alias);
    expect(parsed.ok).toBe(true);
  });
});
