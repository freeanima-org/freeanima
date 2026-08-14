import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { resolveApiOrigin } from "./habitat-origin.ts";

function setWindow(
  shell: { habitatUrl?: string; isTauri?: boolean; isNativeShell?: boolean } | undefined,
  origin = "http://localhost:4173",
): void {
  (
    globalThis as unknown as {
      window: { portalShell?: unknown; location: { origin: string } };
    }
  ).window = {
    portalShell: shell,
    location: { origin },
  };
  document.documentElement.dataset.appUi = "1";
}

describe("resolveApiOrigin", () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    (globalThis as typeof globalThis & { document: Document }).document = {
      documentElement: { dataset: {} } as HTMLElement,
    } as Document;
  });

  afterEach(() => {
    (globalThis as typeof globalThis & { window?: Window }).window = originalWindow;
    (globalThis as typeof globalThis & { document: Document }).document = originalDocument;
  });

  test("app-ui 无 habitatUrl 时回退默认 Habitat，而非页面 origin", () => {
    setWindow(undefined);
    expect(resolveApiOrigin()).toBe("http://127.0.0.1:2658");
  });

  test("优先使用 portalShell.habitatUrl", () => {
    setWindow({ habitatUrl: "http://127.0.0.1:2658/" });
    expect(resolveApiOrigin()).toBe("http://127.0.0.1:2658");
  });

  test("非 bundled 壳仍回退 location.origin", () => {
    delete document.documentElement.dataset.appUi;
    (
      globalThis as unknown as {
        window: { location: { origin: string } };
      }
    ).window = {
      location: { origin: "http://localhost:4175" },
    };
    expect(resolveApiOrigin()).toBe("http://localhost:4175");
  });
});
