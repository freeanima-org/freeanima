import { describe, expect, it } from "bun:test";

import {
  formatSapPlatform,
  formatSapToolName,
  formatSapToolNameAlias,
  isSapPlatform,
  isSapPrefixedToolName,
  isValidSapInstanceId,
  normalizeAppSlug,
  normalizeInstanceId,
  parseSapPlatform,
  parseSapToolName,
  resolveDefaultSapPlatform,
} from "./naming.ts";
import { assertSapInstanceId, generateSapInstanceIdCandidate } from "./instance-id.ts";

describe("sap naming", () => {
  const appId = "pair-programming";
  const instanceId = "k7m";

  it("normalizes app slug and instance id", () => {
    expect(normalizeAppSlug("pair-programming")).toBe("pairprogramming");
    expect(normalizeInstanceId(instanceId)).toBe("k7m");
  });

  it("formats sap platform three segments", () => {
    expect(formatSapPlatform("companion", "k7m")).toBe("sap:companion:k7m");
    expect(isSapPlatform("sap:companion:k7m")).toBe(true);
    const parsed = parseSapPlatform("sap:companion:k7m");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.app_slug).toBe("companion");
      expect(parsed.value.instance_id_norm).toBe("k7m");
    }
  });

  it("resolveDefaultSapPlatform skips empty REST sap ctx", () => {
    expect(resolveDefaultSapPlatform(undefined, "", "")).toBeUndefined();
    expect(resolveDefaultSapPlatform(undefined, "  ", "")).toBeUndefined();
    expect(resolveDefaultSapPlatform(undefined, "companion", "k7m")).toBe("sap:companion:k7m");
    expect(resolveDefaultSapPlatform("chat", "", "")).toBe("chat");
    expect(resolveDefaultSapPlatform("  ", "companion", "k7m")).toBeUndefined();
  });

  it("validates hub instance ids", () => {
    expect(isValidSapInstanceId("k7m")).toBe(true);
    expect(isValidSapInstanceId("ab")).toBe(false);
    expect(isValidSapInstanceId("uuid")).toBe(false);
    expect(assertSapInstanceId("K7M")).toBe("k7m");
    expect(generateSapInstanceIdCandidate()).toMatch(/^[a-z0-9]{3}$/);
  });

  it("formats canonical and alias tool names with short instance id", () => {
    expect(formatSapToolName(appId, instanceId, "scan_code")).toBe(
      "sap_pairprogramming_k7m_scan_code",
    );
    expect(formatSapToolNameAlias(appId, instanceId, "file_read")).toBe(
      "sap:pairprogramming:k7m:file_read",
    );
  });

  it("parses canonical names with underscores in local_name", () => {
    const name = formatSapToolName(appId, instanceId, "file_read");
    const parsed = parseSapToolName(name);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.local_name).toBe("file_read");
      expect(parsed.value.app_slug).toBe("pairprogramming");
      expect(parsed.value.instance_id_norm).toBe("k7m");
    }
  });

  it("parses alias names", () => {
    const alias = formatSapToolNameAlias(appId, instanceId, "scan_code");
    expect(isSapPrefixedToolName(alias)).toBe(true);
    const parsed = parseSapToolName(alias);
    expect(parsed.ok).toBe(true);
  });

  it("rejects malformed sap names", () => {
    expect(parseSapToolName("sap_bad").ok).toBe(false);
    expect(parseSapToolName("file_read").ok).toBe(false);
  });
});
