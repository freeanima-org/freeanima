import { afterEach, describe, expect, it } from "bun:test";

import { resolveAboutNativeBuildMeta } from "./native-build-meta.resolve.ts";

const sampleMeta = {
  component: "native" as const,
  shell: "mobile" as const,
  channel: "dev" as const,
  version: "0.8.4",
};

describe("native-build-meta.resolve", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
    globalThis.fetch = originalFetch;
  });

  it("resolveAboutNativeBuildMeta 优先 satelliteShell.nativeBuild", async () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { nativeBuild: sampleMeta },
    } as unknown as Window;

    const meta = await resolveAboutNativeBuildMeta();
    expect(meta?.version).toBe("0.8.4");
  });

  it("resolveAboutNativeBuildMeta 远程 Android 从 localhost 资产读取", async () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      satelliteShell: { isNativeShell: true },
      dispatchEvent: () => true,
    } as unknown as Window;

    (globalThis as { fetch: typeof fetch }).fetch = (async () =>
      ({
        ok: true,
        json: async () => sampleMeta,
      }) as Response) as unknown as typeof fetch;

    const meta = await resolveAboutNativeBuildMeta();
    expect(meta?.version).toBe("0.8.4");
    expect(window.satelliteShell?.nativeBuild?.version).toBe("0.8.4");
  });
});
