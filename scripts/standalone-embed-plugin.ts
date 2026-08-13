/**
 * Bun.build 插件：在 standalone 编译时把 `standalone-embeds.ts` 替换为
 * 内联 runtime meta（version / buildMeta）。
 *
 * 资源嵌入改由调用点 `dir:`（migrations / docs / web dist）完成。
 */
import type { BunPlugin } from "bun";
import { realpathSync } from "node:fs";

import type { ComponentBuildMeta } from "@freeanima/host/core/config/build-meta.parse";

export function createStandaloneEmbedPlugin(opts: {
  embedsModulePath: string;
  version: string;
  buildMeta: ComponentBuildMeta;
}): BunPlugin {
  const target = realpathSync(opts.embedsModulePath);
  const metaJson = JSON.stringify({
    version: opts.version,
    buildMeta: opts.buildMeta,
  });

  return {
    name: "freeanima-standalone-embeds",
    setup(build) {
      build.onLoad({ filter: /\.ts$/ }, (args) => {
        let resolved: string;
        try {
          resolved = realpathSync(args.path);
        } catch {
          return;
        }
        if (resolved !== target) return;

        const contents = `/** AUTO-INJECTED by scripts/standalone-embed-plugin.ts during just pack cli */
import type { ComponentBuildMeta } from "@freeanima/host/core/config/build-meta.parse";

export type StandaloneRuntimeMetaInject = {
  version: string;
  buildMeta: ComponentBuildMeta;
};

export const standaloneRuntimeMeta: StandaloneRuntimeMetaInject = ${metaJson} as StandaloneRuntimeMetaInject;
`;
        return { contents, loader: "ts" };
      });
    },
  };
}
