import { describe, expect, it } from "bun:test";

import { isHubFetchAvailable, isNetworkOnline } from "./hub-fetch-gate.ts";

describe("hub-fetch-gate", () => {
  it("isNetworkOnline treats missing onLine as online", () => {
    expect(isNetworkOnline()).toBe(true);
  });

  it("isHubFetchAvailable is false when hub not connected", () => {
    expect(isHubFetchAvailable()).toBe(false);
  });
});
