import { describe, expect, test } from "bun:test";
import type { ShellApi } from "@freeanima/frontend/shell-sdk/shell-api";

import { applyHabitatConfigToShell } from "./apply-habitat-to-shell.ts";

function stubShell(): ShellApi {
  return {
    habitatUrl: "http://127.0.0.1:2658",
    habitatWsUrl: "ws://127.0.0.1:2658/rpc/v1",
    createFileInstanceStore: () => ({ load: () => null, save: () => {} }),
  };
}

describe("applyHabitatConfigToShell", () => {
  test("写入 token 后 remoteAuth 可用（解除 needsHabitatSetup）", () => {
    const shell = stubShell();
    applyHabitatConfigToShell(shell, "http://feng-vm.lan:2658/", "secret-token-min-16");
    expect(shell.habitatUrl).toBe("http://feng-vm.lan:2658");
    expect(shell.remoteAuth?.token).toBe("secret-token-min-16");
  });

  test("清空 token 时删除 remoteAuth", () => {
    const shell = stubShell();
    shell.remoteAuth = { token: "old-token-min-16xx" };
    applyHabitatConfigToShell(shell, "http://127.0.0.1:2658", "  ");
    expect(shell.remoteAuth).toBeUndefined();
  });
});
