import { describe, expect, test } from "bun:test";

import { detectHabitatTlsIssuerKind } from "./mkcert-root-ca.ts";

describe("mkcert-root-ca", () => {
  test("detectHabitatTlsIssuerKind returns missing for absent cert", () => {
    expect(detectHabitatTlsIssuerKind("/nonexistent/cert.pem")).toBe("missing");
  });
});
