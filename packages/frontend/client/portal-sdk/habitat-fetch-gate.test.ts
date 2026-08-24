import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import * as habitatConnection from "./habitat-connection.ts";
import { isHabitatFetchAvailable, isNetworkOnline } from "./habitat-fetch-gate.ts";
import { recordHabitatTransportFailure, resetLocalPreferForTests } from "./local-prefer.ts";

describe("habitat-fetch-gate", () => {
  beforeEach(() => {
    resetLocalPreferForTests();
    (globalThis as { window?: Window }).window = {} as Window;
  });

  afterEach(() => {
    resetLocalPreferForTests();
    mock.restore();
    delete (globalThis as { window?: Window }).window;
  });

  it("isNetworkOnline treats missing onLine as online", () => {
    expect(isNetworkOnline()).toBe(true);
  });

  it("isHabitatFetchAvailable is false when habitat disconnected", () => {
    spyOn(habitatConnection, "getHabitatRpcConnectionState").mockReturnValue("disconnected");
    expect(isHabitatFetchAvailable()).toBe(false);
  });

  it("connecting 时仍允许发起 HTTP 读（与实时 WS 条幅解耦）", () => {
    spyOn(habitatConnection, "getHabitatRpcConnectionState").mockReturnValue("connecting");
    expect(isHabitatFetchAvailable()).toBe(true);
  });

  it("localPrefer 开启时即使 Habitat connected 也不发起 RPC", () => {
    spyOn(habitatConnection, "getHabitatRpcConnectionState").mockReturnValue("connected");
    expect(isHabitatFetchAvailable()).toBe(true);
    recordHabitatTransportFailure();
    recordHabitatTransportFailure();
    expect(isHabitatFetchAvailable()).toBe(false);
  });
});
