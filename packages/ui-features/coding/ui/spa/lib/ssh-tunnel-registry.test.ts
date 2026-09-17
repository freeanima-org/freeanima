import { afterEach, describe, expect, test } from "bun:test";

import {
  bindSessionSshTunnel,
  clearSshTunnelRegistryForTest,
  peekSshTunnelHandleForTest,
  releaseAllSshTunnels,
  releaseSessionSshTunnel,
} from "./ssh-tunnel-registry.ts";

afterEach(() => {
  clearSshTunnelRegistryForTest();
  Reflect.deleteProperty(globalThis, "window");
});

describe("ssh-tunnel-registry", () => {
  test("bind / peek / release", async () => {
    const stops: string[] = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        portalShell: {
          sshProcess: {
            run: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
            spawnDetached: async () => ({ handleId: "unused" }),
            stopDetached: async (handleId: string) => {
              stops.push(handleId);
            },
          },
        },
      },
    });

    await bindSessionSshTunnel("s1", "h1");
    expect(peekSshTunnelHandleForTest("s1")).toBe("h1");

    await bindSessionSshTunnel("s1", "h2");
    expect(stops).toEqual(["h1"]);
    expect(peekSshTunnelHandleForTest("s1")).toBe("h2");

    await releaseSessionSshTunnel("s1");
    expect(stops).toEqual(["h1", "h2"]);
    expect(peekSshTunnelHandleForTest("s1")).toBeUndefined();

    await bindSessionSshTunnel("a", "x");
    await bindSessionSshTunnel("b", "y");
    await releaseAllSshTunnels();
    expect(stops).toEqual(["h1", "h2", "x", "y"]);
  });
});
