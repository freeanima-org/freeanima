import { afterAll, describe, expect, it, mock } from "bun:test";

const realGate = await import("./hub-fetch-gate.ts");
const gateOriginal = {
  isHubFetchAvailable: realGate.isHubFetchAvailable,
  isNetworkOnline: realGate.isNetworkOnline,
  isHubConnected: realGate.isHubConnected,
  shellWritesDisabledFromState: realGate.shellWritesDisabledFromState,
};

let hubAvailable = true;
let networkOnline = true;

mock.module("./hub-fetch-gate.ts", () => ({
  ...gateOriginal,
  isHubFetchAvailable: () => hubAvailable,
  isNetworkOnline: () => networkOnline,
}));

afterAll(() => {
  mock.module("./hub-fetch-gate.ts", () => gateOriginal);
});

const { preferOnlineWrite, isRetriableOfflineWriteError } =
  await import("./prefer-online-write.ts");
const { HubRpcTimeoutError } = await import("@freeanima/shared/hub-rpc");

describe("isRetriableOfflineWriteError", () => {
  it("识别传输超时与业务错误", () => {
    expect(isRetriableOfflineWriteError(new HubRpcTimeoutError("x"))).toBe(true);
    expect(isRetriableOfflineWriteError(new Error("Hub RPC WebSocket closed"))).toBe(true);
    expect(isRetriableOfflineWriteError(new Error("diary title is required"))).toBe(false);
  });
});

describe("preferOnlineWrite", () => {
  it("Hub 可用时走 online", async () => {
    hubAvailable = true;
    networkOnline = true;
    const result = await preferOnlineWrite(
      async () => "online",
      async () => "offline",
    );
    expect(result).toBe("online");
  });

  it("Hub 不可用时走 offline", async () => {
    hubAvailable = false;
    const result = await preferOnlineWrite(
      async () => "online",
      async () => "offline",
    );
    expect(result).toBe("offline");
  });

  it("网络失败回退 offline", async () => {
    hubAvailable = true;
    networkOnline = true;
    const result = await preferOnlineWrite(
      async () => {
        throw new HubRpcTimeoutError("timed out");
      },
      async () => "offline",
    );
    expect(result).toBe("offline");
  });

  it("业务错误直接抛出", async () => {
    hubAvailable = true;
    await expect(
      preferOnlineWrite(
        async () => {
          throw new Error("diary title is required");
        },
        async () => "offline",
      ),
    ).rejects.toThrow("diary title is required");
  });
});
