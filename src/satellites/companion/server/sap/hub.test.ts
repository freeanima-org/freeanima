import { afterEach, describe, expect, mock, test } from "bun:test";

const remoteAuthTokenFromShell = mock((): string | undefined => undefined);

const hubHandle = {
  getInstanceId: () => "abc",
  isConnected: () => true,
  reconnect: mock(() => {}),
  stop: mock(() => {}),
  getRpcStreamClient: mock(async () => ({})),
  whenConnected: mock(async () => ({})),
  relayState: null,
};

const createRemoteToolsHub = mock((_opts: unknown) => hubHandle);

mock.module("../config.ts", () => ({
  remoteAuthTokenFromShell: () => remoteAuthTokenFromShell(),
}));

mock.module("@freeanima/shared/rpc-contract/remote-tools-hub.ts", () => ({
  createRemoteToolsHub: (opts: unknown) => createRemoteToolsHub(opts),
}));

mock.module("@freeanima/shared/rpc-contract/file-instance-store.ts", () => ({
  fileRemoteInstanceStore: () => ({
    load: () => null,
    save: () => {},
  }),
}));

const { startSapTransport, reconnectSap, isSapConnected } = await import("./hub.ts");

afterEach(() => {
  remoteAuthTokenFromShell.mockReset();
  remoteAuthTokenFromShell.mockReturnValue(undefined);
  createRemoteToolsHub.mockClear();
  hubHandle.stop.mockClear();
  reconnectSap("http://127.0.0.1:2658", "http://127.0.0.1:4176");
  createRemoteToolsHub.mockClear();
  hubHandle.stop.mockClear();
});

describe("companion startSapTransport", () => {
  test("无 Habitat API Token 时不启动 SAP（不抛错）", () => {
    remoteAuthTokenFromShell.mockReturnValue(undefined);
    expect(() => startSapTransport("http://127.0.0.1:2658", "http://127.0.0.1:4176")).not.toThrow();
    expect(createRemoteToolsHub).not.toHaveBeenCalled();
    expect(isSapConnected()).toBe(false);
  });

  test("有 token 时调用 createRemoteToolsHub", () => {
    remoteAuthTokenFromShell.mockReturnValue("test-token-min-16-chars");
    expect(() => startSapTransport("http://127.0.0.1:2658", "http://127.0.0.1:4176")).not.toThrow();
    expect(createRemoteToolsHub).toHaveBeenCalled();
    const arg = createRemoteToolsHub.mock.calls[0]?.[0] as {
      remoteAuthToken?: string;
      appId?: string;
    };
    expect(arg?.appId).toBe("companion");
    expect(arg?.remoteAuthToken).toBe("test-token-min-16-chars");
  });

  test("reconnectSap 在有 token 时重建 hub", () => {
    remoteAuthTokenFromShell.mockReturnValue("test-token-min-16-chars");
    startSapTransport("http://127.0.0.1:2658", "http://127.0.0.1:4176");
    createRemoteToolsHub.mockClear();
    hubHandle.stop.mockClear();
    reconnectSap("http://127.0.0.1:2701", "http://127.0.0.1:4177");
    expect(hubHandle.stop).toHaveBeenCalled();
    expect(createRemoteToolsHub).toHaveBeenCalled();
  });
});
