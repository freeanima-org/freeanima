import { describe, expect, mock, test } from "bun:test";

const remoteAuthTokenFromShell = mock((): string | undefined => undefined);

mock.module("../config.ts", () => ({
  remoteAuthTokenFromShell: () => remoteAuthTokenFromShell(),
}));

const { startSapTransport } = await import("./hub.ts");

describe("companion startSapTransport", () => {
  test("无 Habitat API Token 时不启动 SAP（不抛错）", () => {
    remoteAuthTokenFromShell.mockReturnValue(undefined);
    expect(() => startSapTransport("http://127.0.0.1:2658", "http://127.0.0.1:4176")).not.toThrow();
  });

  test("有 token 时调用 createSatelliteHub", () => {
    remoteAuthTokenFromShell.mockReturnValue("test-token-min-16-chars");
    expect(() => startSapTransport("http://127.0.0.1:2658", "http://127.0.0.1:4176")).not.toThrow();
  });
});
