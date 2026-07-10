import { describe, expect, test } from "bun:test";

import { isOptionalAuthHubHttpRequest } from "@freeanima/platform/hub/http-rest-auth.ts";

describe("tls-ca auth via registry", () => {
  test("tls.ca paths are optional auth", () => {
    expect(
      isOptionalAuthHubHttpRequest(new Request("http://127.0.0.1:2658/hub/rpc/v1/tls/ca")),
    ).toBe(true);
    expect(
      isOptionalAuthHubHttpRequest(new Request("http://127.0.0.1:2658/hub/rpc/v1/tls/ca/info")),
    ).toBe(true);
    expect(
      isOptionalAuthHubHttpRequest(
        new Request("http://127.0.0.1:2658/hub/rpc/v1/tls/ca/qr?size=256"),
      ),
    ).toBe(true);
    expect(
      isOptionalAuthHubHttpRequest(
        new Request("http://127.0.0.1:2658/hub/rpc/v1/tls/ca", { method: "POST" }),
      ),
    ).toBe(false);
  });
});
