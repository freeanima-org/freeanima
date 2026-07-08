import { describe, expect, test } from "bun:test";

import { isTlsCaPublicPath } from "./remote-auth.ts";

describe("isTlsCaPublicPath", () => {
  test("allows GET tls ca endpoints without auth", () => {
    expect(isTlsCaPublicPath(new Request("http://127.0.0.1:2658/api/tls/ca"))).toBe(true);
    expect(isTlsCaPublicPath(new Request("http://127.0.0.1:2658/api/tls/ca/info"))).toBe(true);
    expect(isTlsCaPublicPath(new Request("http://127.0.0.1:2658/api/tls/ca/qr"))).toBe(true);
    expect(
      isTlsCaPublicPath(new Request("http://127.0.0.1:2658/api/tls/ca", { method: "POST" })),
    ).toBe(false);
    expect(isTlsCaPublicPath(new Request("http://127.0.0.1:2658/api/status"))).toBe(false);
  });
});
