import { describe, expect, test } from "bun:test";

import { buildHabitatRestRequest } from "@freeanima/shared/habitat-rpc";

import { habitatHttpFromWsUrl } from "./http-auth.ts";

describe("habitatHttpFromWsUrl", () => {
  test("strips /rpc/v1 from ws origin", () => {
    expect(habitatHttpFromWsUrl("ws://127.0.0.1:18139/rpc/v1")).toBe("http://127.0.0.1:18139");
    expect(habitatHttpFromWsUrl("wss://localhost:5003/rpc/v1/")).toBe("https://localhost:5003");
  });

  test("builds status.get without double /rpc/v1 prefix", () => {
    const httpOrigin = habitatHttpFromWsUrl("wss://localhost:5003/rpc/v1");
    const { url } = buildHabitatRestRequest(httpOrigin, "status.get", {});
    expect(url).toBe("https://localhost:5003/rpc/v1/status/get");
  });
});
