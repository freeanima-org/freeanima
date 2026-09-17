import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

import { resetLocalPreferForTests } from "./local-prefer.ts";

const realGate = await import("./habitat-fetch-gate.ts");
const gateOriginal = {
  isHabitatFetchAvailable: realGate.isHabitatFetchAvailable,
  isNetworkOnline: realGate.isNetworkOnline,
  isHabitatConnected: realGate.isHabitatConnected,
  shellWritesDisabledFromState: realGate.shellWritesDisabledFromState,
};

let hubAvailable = true;
let networkOnline = true;

mock.module("./habitat-fetch-gate.ts", () => ({
  ...gateOriginal,
  isHabitatFetchAvailable: () => hubAvailable,
  isNetworkOnline: () => networkOnline,
}));

afterAll(() => {
  mock.module("./habitat-fetch-gate.ts", () => gateOriginal);
});

const { preferOnlineWrite, isRetriableOfflineWriteError } =
  await import("./prefer-online-write.ts");
const { HabitatRpcTimeoutError } = await import("@freeanima/shared/habitat-rpc");

describe("isRetriableOfflineWriteError", () => {
  it("识别传输超时与业务错误", () => {
    expect(isRetriableOfflineWriteError(new HabitatRpcTimeoutError("x"))).toBe(true);
    expect(isRetriableOfflineWriteError(new Error("Habitat RPC WebSocket closed"))).toBe(true);
    expect(isRetriableOfflineWriteError(new Error("diary title is required"))).toBe(false);
  });
});

describe("preferOnlineWrite", () => {
  beforeEach(() => {
    resetLocalPreferForTests();
    hubAvailable = true;
    networkOnline = true;
  });
  it("Habitat 可用时走 online", async () => {
    hubAvailable = true;
    networkOnline = true;
    const result = await preferOnlineWrite(
      async () => "online",
      async () => "offline",
    );
    expect(result).toBe("online");
  });

  it("Habitat 不可用时走 offline", async () => {
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
        throw new HabitatRpcTimeoutError("timed out");
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
