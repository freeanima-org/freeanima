import { describe, expect, test } from "bun:test";

import { isOptionalAuthHabitatHttpRequest } from "@freeanima/habitat/platform/habitat/http-rest-auth.ts";

describe("tls-ca auth via registry", () => {
  test("tls.ca paths are optional auth", () => {
    expect(
      isOptionalAuthHabitatHttpRequest(new Request("http://127.0.0.1:2658/rpc/v1/tls/ca")),
    ).toBe(true);
    expect(
      isOptionalAuthHabitatHttpRequest(new Request("http://127.0.0.1:2658/rpc/v1/tls/ca/info")),
    ).toBe(true);
    expect(
      isOptionalAuthHabitatHttpRequest(
        new Request("http://127.0.0.1:2658/rpc/v1/tls/ca/qr?size=256"),
      ),
    ).toBe(true);
    expect(
      isOptionalAuthHabitatHttpRequest(
        new Request("http://127.0.0.1:2658/rpc/v1/tls/ca", { method: "POST" }),
      ),
    ).toBe(false);
  });
});
