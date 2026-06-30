import { describe, expect, test } from "bun:test";
import type { SatelliteShellApi } from "@freeanima/shell-sdk/shell-api";

import { needsHubSetup } from "./hub-setup.ts";

function stubShell(
  partial: Partial<SatelliteShellApi> & Pick<SatelliteShellApi, "isElectron">,
): SatelliteShellApi {
  return {
    hubUrl: "",
    hubWsUrl: "",
    createFileInstanceStore: () => ({ load: () => null, save: () => {} }),
    ...partial,
  };
}

describe("needsHubSetup", () => {
  test("仅 Web 壳层在未配置 token 时需要引导", () => {
    expect(
      needsHubSetup(
        stubShell({
          isElectron: false,
          hubUrl: "http://127.0.0.1:2658",
          hubWsUrl: "ws://127.0.0.1:2658/sap/v1",
        }),
      ),
    ).toBe(true);

    expect(
      needsHubSetup(
        stubShell({
          isElectron: false,
          hubUrl: "http://127.0.0.1:2658",
          hubWsUrl: "ws://127.0.0.1:2658/sap/v1",
          remoteAuth: { token: "a".repeat(16) },
        }),
      ),
    ).toBe(false);
  });

  test("桌面与移动壳层不进入 Web 引导", () => {
    expect(needsHubSetup(stubShell({ isElectron: true }))).toBe(false);
    expect(needsHubSetup(stubShell({ isElectron: false, isNativeShell: true }))).toBe(false);
  });
});
