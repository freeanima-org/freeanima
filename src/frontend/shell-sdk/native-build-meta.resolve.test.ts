import { afterEach, describe, expect, it } from "bun:test";

import { resolveAboutNativeBuildMeta } from "./native-build-meta.resolve.ts";

const sampleMeta = {
  component: "native" as const,
  shell: "mobile" as const,
  channel: "dev" as const,
  version: "0.8.4",
};

describe("native-build-meta.resolve", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("resolveAboutNativeBuildMeta 优先 satelliteShell.nativeBuild", async () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { nativeBuild: sampleMeta },
    } as unknown as Window;

    const meta = await resolveAboutNativeBuildMeta();
    expect(meta?.version).toBe("0.8.4");
  });
});
