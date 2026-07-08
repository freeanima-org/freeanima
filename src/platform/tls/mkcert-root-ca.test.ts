import { describe, expect, test } from "bun:test";

import { detectHubTlsIssuerKind } from "./mkcert-root-ca.ts";

describe("mkcert-root-ca", () => {
  test("detectHubTlsIssuerKind returns missing for absent cert", () => {
    expect(detectHubTlsIssuerKind("/nonexistent/cert.pem")).toBe("missing");
  });
});
