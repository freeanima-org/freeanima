import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Context } from "cordis";

import { runBootPipelineViaLoader } from "./loader.ts";
import type { BootPipelineConfig } from "./boot-context.ts";

function fakePipeline(): BootPipelineConfig {
  return {
    statusHost: "127.0.0.1",
    port: 0,
    onConversationUpdated: () => {},
    runtimeRef: { current: null },
    acpSessionUpdatedRef: { handler: null },
    serveOpts: {},
  };
}

describe("runBootPipelineViaLoader", () => {
  it("mounts the plugins listed in the config file", async () => {
    const dir = await mkdtemp(join(import.meta.dir, ".tmp-boot-loader-"));
    try {
      await writeFile(
        join(dir, "probe-plugin.ts"),
        'export default { name: "probe", apply() { globalThis.freeanimaLoaderProbe = true; } };\n',
      );
      await writeFile(join(dir, "cordis.yml"), "- name: ./probe-plugin.ts\n");

      const ctx = new Context();
      await runBootPipelineViaLoader(ctx, fakePipeline(), {
        baseDir: dir,
        configPath: "./cordis.yml",
      });

      expect((globalThis as { freeanimaLoaderProbe?: boolean }).freeanimaLoaderProbe).toBe(true);
    } finally {
      delete (globalThis as { freeanimaLoaderProbe?: boolean }).freeanimaLoaderProbe;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
