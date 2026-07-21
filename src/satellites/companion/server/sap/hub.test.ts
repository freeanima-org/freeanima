import { afterEach, describe, expect, test } from "bun:test";

import { isRemoteToolsConnected, reconnectRemoteTools, startRemoteToolsTransport } from "./hub.ts";

afterEach(() => {
  reconnectRemoteTools("http://127.0.0.1:2658");
});

describe("companion server hub (deprecated no-op)", () => {
  test("startRemoteToolsTransport 不再启动 Node hub", () => {
    expect(() =>
      startRemoteToolsTransport("http://127.0.0.1:2658", "http://127.0.0.1:4176"),
    ).not.toThrow();
    expect(isRemoteToolsConnected()).toBe(false);
  });

  test("reconnectRemoteTools 为 no-op", () => {
    expect(() => reconnectRemoteTools("http://127.0.0.1:2701")).not.toThrow();
    expect(isRemoteToolsConnected()).toBe(false);
  });
});
