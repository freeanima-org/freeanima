/**
 * Bun.build 插件：在 standalone 编译时把 `standalone-embeds.ts` 替换为
 * 带 `with { type: "file" }` 的嵌入清单（不写磁盘 codegen 入口）。
 */
import type { BunPlugin } from "bun";
import { realpathSync } from "node:fs";

export type StandaloneEmbedInput = {
  kind: "migration" | "web";
  rel: string;
  absPath: string;
};

export function createStandaloneEmbedPlugin(opts: {
  embedsModulePath: string;
  files: StandaloneEmbedInput[];
}): BunPlugin {
  const target = realpathSync(opts.embedsModulePath);

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

        const contents = `/** AUTO-INJECTED by scripts/standalone-embed-plugin.ts during build:cli:executable */
export type StandaloneEmbedFile = {
  kind: "migration" | "web";
  rel: string;
  path: string;
};

${importLines.join("\n")}

export const standaloneEmbeds: StandaloneEmbedFile[] = [
${entries.join(",\n")}
];
`;
        return { contents, loader: "ts" };
      });
    },
  };
}
