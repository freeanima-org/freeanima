import { afterEach, describe, expect, it } from "bun:test";

import { DEFAULT_HUB_ORIGIN, resolveHubApiOrigin } from "./hub-api-origin.ts";

const prevWindow = globalThis.window;

afterEach(() => {
  if (prevWindow === undefined) {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  } else {
    globalThis.window = prevWindow;
  }
});

describe("resolveHubApiOrigin", () => {
  it("prefers satelliteShell.hubUrl", () => {
    globalThis.window = {
      location: { origin: "http://192.168.1.10:2658", pathname: "/web/chat" },
      satelliteShell: { hubUrl: "https://hub.example.com" },
    } as Window & typeof globalThis;
    expect(resolveHubApiOrigin()).toBe("https://hub.example.com");
  });

  it("uses location.origin for Hub-hosted /web/* when shell hubUrl is empty", () => {
    globalThis.window = {
      location: { origin: "http://192.168.1.10:2658", pathname: "/web/chat", port: "2658" },
      document: { documentElement: { dataset: { shellUi: "1" } } },
    } as unknown as Window & typeof globalThis;
    expect(resolveHubApiOrigin()).toBe("http://192.168.1.10:2658");
  });

  it("falls back to default for bundled dev shell", () => {
    globalThis.window = {
      location: { origin: "http://127.0.0.1:4173", pathname: "/web/chat", port: "4173" },
      document: { documentElement: { dataset: { shellUi: "1" } } },
      satelliteShell: { isElectron: true, hubUrl: "" },
    } as unknown as Window & typeof globalThis;
    expect(resolveHubApiOrigin()).toBe(DEFAULT_HUB_ORIGIN);
  });
});
