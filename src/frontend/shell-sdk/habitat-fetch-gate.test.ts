import { describe, expect, it } from "bun:test";

import { isHabitatFetchAvailable, isNetworkOnline } from "./habitat-fetch-gate.ts";

describe("habitat-fetch-gate", () => {
  it("isNetworkOnline treats missing onLine as online", () => {
    expect(isNetworkOnline()).toBe(true);
  });

  it("isHabitatFetchAvailable is false when hub not connected", () => {
    expect(isHabitatFetchAvailable()).toBe(false);
  });
});
