import { describe, expect, test } from "bun:test";
import type { ShellApi } from "@freeanima/frontend/shell-sdk/shell-api";

import { needsHabitatSetup } from "./habitat-setup.ts";

function stubShell(partial: Partial<ShellApi> = {}): ShellApi {
  return {
    habitatUrl: "",
    habitatWsUrl: "",
    createFileInstanceStore: () => ({ load: () => null, save: () => {} }),
    ...partial,
  };
}

describe("needsHabitatSetup", () => {
  test("未配置 token 时需要引导（含 Mobile 原生壳）", () => {
    expect(
      needsHabitatSetup(
        stubShell({
          habitatUrl: "http://127.0.0.1:2658",
          habitatWsUrl: "ws://127.0.0.1:2658/rpc/v1",
        }),
      ),
    ).toBe(true);

    expect(
      needsHabitatSetup(
        stubShell({
          habitatUrl: "http://127.0.0.1:2658",
          habitatWsUrl: "ws://127.0.0.1:2658/rpc/v1",
        }),
      ),
    ).toBe(true);

    expect(
      needsHabitatSetup(
        stubShell({
          isNativeShell: true,
          habitatUrl: "http://127.0.0.1:2658",
          habitatWsUrl: "ws://127.0.0.1:2658/rpc/v1",
        }),
      ),
    ).toBe(true);

    expect(
      needsHabitatSetup(
        stubShell({
          habitatUrl: "http://127.0.0.1:2658",
          habitatWsUrl: "ws://127.0.0.1:2658/rpc/v1",
          remoteAuth: { token: "a".repeat(16) },
        }),
      ),
    ).toBe(false);
  });

  test("已配置 token 的原生壳不需要引导", () => {
    expect(
      needsHabitatSetup(
        stubShell({
          isNativeShell: true,
          remoteAuth: { token: "a".repeat(16) },
        }),
      ),
    ).toBe(false);
  });
});
