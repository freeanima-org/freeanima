import { describe, expect, it } from "bun:test";

import {
  formatSapToolName,
  formatSapToolNameAlias,
  isSapPrefixedToolName,
  normalizeAppSlug,
  normalizeInstanceId,
  parseSapToolName,
} from "./naming.ts";

describe("sap naming", () => {
  const appId = "pair-programming";
  const instanceId = "550e8400-e29b-41d4-a716-446655440000";
  const instNorm = "550e8400e29b41d4a716446655440000";

  it("normalizes app slug and instance id", () => {
    expect(normalizeAppSlug("pair-programming")).toBe("pairprogramming");
    expect(normalizeInstanceId(instanceId)).toBe(instNorm);
  });

  it("formats canonical and alias tool names", () => {
    expect(formatSapToolName(appId, instanceId, "scan_code")).toBe(
      `sap_pairprogramming_${instNorm}_scan_code`,
    );
    expect(formatSapToolNameAlias(appId, instanceId, "file_read_file")).toBe(
      `sap:pairprogramming:${instNorm}:file_read_file`,
    );
  });

  it("parses canonical names with underscores in local_name", () => {
    const name = formatSapToolName(appId, instanceId, "file_read_file");
    const parsed = parseSapToolName(name);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.local_name).toBe("file_read_file");
      expect(parsed.value.app_slug).toBe("pairprogramming");
      expect(parsed.value.instance_id_norm).toBe(instNorm);
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
    expect(parseSapToolName("file_read_file").ok).toBe(false);
  });
});
