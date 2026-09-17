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

  it("provides ctx.features to loader-mounted plugins", async () => {
    const dir = await mkdtemp(join(import.meta.dir, ".tmp-boot-features-"));
    try {
      await writeFile(
        join(dir, "probe-plugin.ts"),
        'export default { name: "probe", inject: ["features"], apply(ctx) { globalThis.freeanimaFeatureProbe = ctx.features !== undefined; } };\n',
      );
      await writeFile(join(dir, "cordis.yml"), "- name: ./probe-plugin.ts\n");

      const ctx = new Context();
      await runBootPipelineViaLoader(ctx, fakePipeline(), {
        baseDir: dir,
        configPath: "./cordis.yml",
      });

      expect(ctx.get("features")).toBeDefined();
      expect((globalThis as { freeanimaFeatureProbe?: boolean }).freeanimaFeatureProbe).toBe(true);
    } finally {
      delete (globalThis as { freeanimaFeatureProbe?: boolean }).freeanimaFeatureProbe;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("mounts timer and activates ctx.hmr when hot reload is enabled", async () => {
    const dir = await mkdtemp(join(import.meta.dir, ".tmp-boot-hmr-"));
    try {
      await writeFile(
        join(dir, "probe-plugin.ts"),
        'export default { name: "probe", apply() {} };\n',
      );
      await writeFile(join(dir, "cordis.yml"), "- name: ./probe-plugin.ts\n");

      const ctx = new Context();
      const handle = await runBootPipelineViaLoader(ctx, fakePipeline(), {
        baseDir: dir,
        configPath: "./cordis.yml",
        hmr: true,
      });
      try {
        // `hmr` only resolves once its `loader` + `timer` injections are satisfied.
        expect(handle.hmr).toBeDefined();
        expect(ctx.get("hmr")).toBeDefined();
        expect(ctx.get("timer")).toBeDefined();
      } finally {
        await handle.dispose();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("hot reloads cordis.yml changes through the include watcher", async () => {
    const dir = await mkdtemp(join(import.meta.dir, ".tmp-boot-reload-"));
    const writeProbe = async (name: string): Promise<void> => {
      await writeFile(
        join(dir, `${name}.ts`),
        `export default { name: "${name}", apply() { globalThis.freeanimaReloadProbe = "${name}"; } };\n`,
      );
    };
    try {
      await writeProbe("probe-a");
      await writeProbe("probe-b");
      await writeFile(join(dir, "cordis.yml"), "- name: ./probe-a.ts\n");

      const ctx = new Context();
      const handle = await runBootPipelineViaLoader(ctx, fakePipeline(), {
        baseDir: dir,
        configPath: "./cordis.yml",
        hmr: true,
      });
      try {
        expect((globalThis as { freeanimaReloadProbe?: string }).freeanimaReloadProbe).toBe(
          "probe-a",
        );

        await writeFile(join(dir, "cordis.yml"), "- name: ./probe-a.ts\n- name: ./probe-b.ts\n");
        const deadline = Date.now() + 8000;
        while (
          (globalThis as { freeanimaReloadProbe?: string }).freeanimaReloadProbe !== "probe-b" &&
          Date.now() < deadline
        ) {
          await new Promise<void>((r) => {
            setTimeout(r, 50);
          });
        }
        expect((globalThis as { freeanimaReloadProbe?: string }).freeanimaReloadProbe).toBe(
          "probe-b",
        );
      } finally {
        await handle.dispose();
      }
    } finally {
      delete (globalThis as { freeanimaReloadProbe?: string }).freeanimaReloadProbe;
      await rm(dir, { recursive: true, force: true });
    }
  }, 20000);
});
