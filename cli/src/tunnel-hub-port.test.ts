import { describe, expect, test } from "bun:test";
import { DEFAULT_HUB_PORT, resolveHubPort } from "./tunnel-hub-port.ts";

describe("resolveHubPort", () => {
  test("CLI override takes precedence", () => {
    expect(resolveHubPort(3000)).toBe(3000);
  });

  test("falls back to default when no status file", () => {
    expect(resolveHubPort()).toBe(DEFAULT_HUB_PORT);
  });
});
