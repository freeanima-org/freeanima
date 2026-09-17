import { afterEach, describe, expect, it } from "bun:test";

import { resolveAboutNativeBuildMeta } from "./native-build-meta.resolve.ts";

const sampleMeta = {
  component: "native" as const,
  shell: "mobile" as const,
  channel: "local" as const,
  version: "0.8.4",
};

describe("native-build-meta.resolve", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
    globalThis.fetch = originalFetch;
  });

  it("resolveAboutNativeBuildMeta 优先 portalShell.nativeBuild", async () => {
    (globalThis as { window: Window }).window = {
      portalShell: { nativeBuild: sampleMeta },
    } as unknown as Window;

    const meta = await resolveAboutNativeBuildMeta();
    expect(meta?.version).toBe("0.8.4");
  });

  it("resolveAboutNativeBuildMeta Tauri 从 asset 读取", async () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      location: {
        origin: "https://tauri.localhost",
        protocol: "https:",
        hostname: "tauri.localhost",
        href: "https://tauri.localhost/",
      },
      portalShell: { isTauri: true, isNativeShell: true },
      dispatchEvent: () => true,
    } as unknown as Window;

    (globalThis as { fetch: typeof fetch }).fetch = (async () =>
      ({
        ok: true,
        json: async () => sampleMeta,
      }) as Response) as unknown as typeof fetch;

    const meta = await resolveAboutNativeBuildMeta();
    expect(meta?.version).toBe("0.8.4");
    expect(window.portalShell?.nativeBuild?.version).toBe("0.8.4");
  });
});
