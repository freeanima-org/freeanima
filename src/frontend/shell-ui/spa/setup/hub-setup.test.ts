import { describe, expect, test } from "bun:test";
import type { SatelliteShellApi } from "@freeanima/frontend/shell-sdk/shell-api";

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
  test("未配置 token 时需要引导（含 Mobile 原生壳）", () => {
    expect(
      needsHubSetup(
        stubShell({
          isElectron: false,
          hubUrl: "http://127.0.0.1:2658",
          hubWsUrl: "ws://127.0.0.1:2658/hub/rpc/v1",
        }),
      ),
    ).toBe(true);

    expect(
      needsHubSetup(
        stubShell({
          isElectron: true,
          hubUrl: "http://127.0.0.1:2658",
          hubWsUrl: "ws://127.0.0.1:2658/hub/rpc/v1",
        }),
      ),
    ).toBe(true);

    expect(
      needsHubSetup(
        stubShell({
          isElectron: false,
          isNativeShell: true,
          hubUrl: "http://127.0.0.1:2658",
          hubWsUrl: "ws://127.0.0.1:2658/hub/rpc/v1",
        }),
      ),
    ).toBe(true);

    expect(
      needsHubSetup(
        stubShell({
          isElectron: false,
          hubUrl: "http://127.0.0.1:2658",
          hubWsUrl: "ws://127.0.0.1:2658/hub/rpc/v1",
          remoteAuth: { token: "a".repeat(16) },
        }),
      ),
    ).toBe(false);
  });

  test("已配置 token 的原生壳不需要引导", () => {
    expect(
      needsHubSetup(
        stubShell({
          isElectron: false,
          isNativeShell: true,
          remoteAuth: { token: "a".repeat(16) },
        }),
      ),
    ).toBe(false);
  });
});
