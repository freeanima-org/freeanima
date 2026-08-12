import { describe, expect, test } from "bun:test";

import {
  isHttpTlsEnabledInConfigYaml,
  shouldEnableDevWebHttps,
  readDevWebTokenPlaintext,
} from "./dev-https.ts";

describe("dev-https helpers", () => {
  test("isHttpTlsEnabledInConfigYaml detects http.tls.enabled", () => {
    expect(
      isHttpTlsEnabledInConfigYaml(`
http:
  host: 127.0.0.1
  tls:
    enabled: true
    port: 2659
`),
    ).toBe(true);
    expect(
      isHttpTlsEnabledInConfigYaml(`
http:
  host: 127.0.0.1
  tls:
    enabled: false
`),
    ).toBe(false);
    expect(isHttpTlsEnabledInConfigYaml("database:\n  url: x\n")).toBe(false);
  });

  test("shouldEnableDevWebHttps is opt-in via DEV_HTTPS only", () => {
    expect(shouldEnableDevWebHttps({})).toBe(false);
    expect(shouldEnableDevWebHttps({ DEV_HTTPS: "1" })).toBe(true);
    expect(shouldEnableDevWebHttps({ DEV_HTTPS: "true" })).toBe(true);
    expect(shouldEnableDevWebHttps({ DEV_HTTPS: "0" })).toBe(false);
    expect(shouldEnableDevWebHttps({ DEV_HTTPS: "false" })).toBe(false);
  });

  test("readDevWebTokenPlaintext prefers FREEANIMA_DEV_TOKEN", () => {
    expect(readDevWebTokenPlaintext({ FREEANIMA_DEV_TOKEN: " fa_at_test " })).toBe("fa_at_test");
  });
});
