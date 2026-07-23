import { afterEach, describe, expect, it } from "bun:test";

import { DEFAULT_HUB_ORIGIN, resolveHabitatApiOrigin } from "./habitat-api-origin.ts";

const prevWindow = globalThis.window;

afterEach(() => {
  if (prevWindow === undefined) {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  } else {
    globalThis.window = prevWindow;
  }
});

describe("resolveHabitatApiOrigin", () => {
  it("prefers satelliteShell.habitatUrl", () => {
    globalThis.window = {
      location: { origin: "http://192.168.1.10:2658", pathname: "/web/chat" },
      satelliteShell: { habitatUrl: "https://hub.example.com" },
    } as Window & typeof globalThis;
    expect(resolveHabitatApiOrigin()).toBe("https://hub.example.com");
  });

  it("uses location.origin for Web when shell habitatUrl is empty", () => {
    globalThis.window = {
      location: { origin: "http://127.0.0.1:5000", pathname: "/web/chat", port: "5000" },
      document: { documentElement: { dataset: { shellUi: "1" } } },
      satelliteShell: { habitatUrl: "" },
    } as unknown as Window & typeof globalThis;
    expect(resolveHabitatApiOrigin()).toBe("http://127.0.0.1:5000");
  });

  it("uses location.origin for Habitat-hosted /web/* when shell habitatUrl is empty", () => {
    globalThis.window = {
      location: { origin: "http://192.168.1.10:2658", pathname: "/web/chat", port: "2658" },
      document: { documentElement: { dataset: { shellUi: "1" } } },
    } as unknown as Window & typeof globalThis;
    expect(resolveHabitatApiOrigin()).toBe("http://192.168.1.10:2658");
  });

  it("falls back to default for Portal shell without habitatUrl", () => {
    globalThis.window = {
      location: { origin: "http://127.0.0.1:5000", pathname: "/web/chat", port: "5000" },
      document: { documentElement: { dataset: { shellUi: "1" } } },
      satelliteShell: { isTauri: true, isNativeShell: true, habitatUrl: "" },
    } as unknown as Window & typeof globalThis;
    expect(resolveHabitatApiOrigin()).toBe(DEFAULT_HUB_ORIGIN);
  });
});
