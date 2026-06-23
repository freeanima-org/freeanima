import { describe, expect, test } from "bun:test";

import { frontendManifestSchema, parseManifestJson, toManifestJson } from "./manifest.ts";

describe("frontendManifestSchema", () => {
  test("supportsDesktop 与 supportsMobile 必填", () => {
    const manifest = frontendManifestSchema.parse({
      appId: "chat",
      displayName: "会客厅",
      version: "0.7.0",
      supportsDesktop: true,
      supportsMobile: true,
      connectionKind: "sap-direct",
      sap: { relay: false },
    });
    expect(manifest.supportsDesktop).toBe(true);
    const json = toManifestJson(manifest);
    expect(parseManifestJson(json).appId).toBe("chat");
  });
});
