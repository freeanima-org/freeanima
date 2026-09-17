import { describe, expect, test } from "bun:test";

import { isOptionalAuthHabitatHttpRequest } from "./http-rest-auth.ts";

describe("http-rest-auth", () => {
  test("health.probe is optional auth", () => {
    expect(
      isOptionalAuthHabitatHttpRequest(new Request("http://127.0.0.1:2658/rpc/v1/health/probe")),
    ).toBe(true);
  });

  test("tasklist.item.list requires auth", () => {
    expect(
      isOptionalAuthHabitatHttpRequest(
        new Request("http://127.0.0.1:2658/rpc/v1/tasklist/item/list"),
      ),
    ).toBe(false);
  });

  test("tls.ca routes are optional auth", () => {
    expect(
      isOptionalAuthHabitatHttpRequest(new Request("http://127.0.0.1:2658/rpc/v1/tls/ca")),
    ).toBe(true);
    expect(
      isOptionalAuthHabitatHttpRequest(new Request("http://127.0.0.1:2658/rpc/v1/tls/ca/info")),
    ).toBe(true);
  });
});
