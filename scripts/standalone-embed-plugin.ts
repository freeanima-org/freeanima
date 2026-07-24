/**
 * Bun.build 插件：在 standalone 编译时把 `standalone-embeds.ts` 替换为
 * 带 `with { type: "file" }` 的嵌入清单 + 内联 runtime meta（version / buildMeta）。
 */
import type { BunPlugin } from "bun";
import { realpathSync } from "node:fs";

import type { ComponentBuildMeta } from "@freeanima/core/config/build-meta.parse";

export type StandaloneEmbedInput = {
  kind: "migration" | "web" | "docs";
  rel: string;
  absPath: string;
};

export function createStandaloneEmbedPlugin(opts: {
  embedsModulePath: string;
  files: StandaloneEmbedInput[];
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

        const importLines: string[] = [];
        const entries: string[] = [];
        for (const [i, file] of opts.files.entries()) {
          const id = `embed${i}`;
          importLines.push(
            `import ${id} from ${JSON.stringify(file.absPath)} with { type: "file" };`,
          );
          entries.push(
            `  { kind: ${JSON.stringify(file.kind)}, rel: ${JSON.stringify(file.rel)}, path: ${id} }`,
          );
        }

        const contents = `/** AUTO-INJECTED by scripts/standalone-embed-plugin.ts during just pack cli */
import type { ComponentBuildMeta } from "@freeanima/core/config/build-meta.parse";

export type StandaloneEmbedFile = {
  kind: "migration" | "web" | "docs";
  rel: string;
  path: string;
};

export type StandaloneRuntimeMetaInject = {
  version: string;
  buildMeta: ComponentBuildMeta;
};

${importLines.join("\n")}

export const standaloneEmbeds: StandaloneEmbedFile[] = [
${entries.join(",\n")}
];

export const standaloneRuntimeMeta: StandaloneRuntimeMetaInject = ${metaJson} as StandaloneRuntimeMetaInject;
`;
        return { contents, loader: "ts" };
      });
    },
  };
}
