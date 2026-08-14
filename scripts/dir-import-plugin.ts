/**
 * Bun 插件：`import assets from "dir:./some/dir"` → 递归目录内文件的
 * `with { type: "file" }` 路径 map（嵌套键为相对根的 POSIX 路径）。
 *
 * Runtime：`bunfig.toml` preload；Bun.build / `--compile`：传入 `plugins`。
 * 生产用法：migrations / docs / web dist 的 `*-dir-import` 模块。
 * 目录不存在时导出空 map（源码 CLI 在尚未 pack web 时不致崩；
 * oxlint `dir-import-exists` 要求目录在仓内，web dist 可用 `.gitignore` 占位）。
 */
import type { BunPlugin } from "bun";
import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export type DirImportEntry = {
  /** 相对目录根的 POSIX 路径，如 `nested/child.txt` */
  rel: string;
  abs: string;
};

const DIR_PREFIX = "dir:";

/** 将目录条目合成可被 bundler 继续解析的模块源码 */
export function buildDirImportModuleSource(entries: DirImportEntry[]): string {
  const sorted = [...entries].toSorted((a, b) => a.rel.localeCompare(b.rel));
  const importLines: string[] = [];
  const mapLines: string[] = [];
  for (const [i, e] of sorted.entries()) {
    const id = `f${i}`;
    importLines.push(`import ${id} from ${JSON.stringify(e.abs)} with { type: "file" };`);
    mapLines.push(`  ${JSON.stringify(e.rel)}: ${id}`);
  }
  return `${importLines.join("\n")}
export default {
${mapLines.join(",\n")}
};
`;
}

/** 递归列出普通文件（跳过 symlink） */
export function listDirImportEntries(absDir: string): DirImportEntry[] {
  const out: DirImportEntry[] = [];

  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      let st;
      try {
        st = lstatSync(abs);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!st.isFile()) continue;
      const rel = relative(absDir, abs).split(sep).join("/");
      out.push({ rel, abs });
    }
  }

  walk(absDir);
  return out;
}

function stripDirPrefix(specifier: string): string {
  if (specifier.startsWith(DIR_PREFIX)) return specifier.slice(DIR_PREFIX.length);
  return specifier;
}

function resolveDirPath(specifierPath: string, importer: string | undefined): string {
  const raw = stripDirPrefix(specifierPath);
  if (isAbsolute(raw)) return resolve(raw);
  const base = importer ? dirname(importer) : process.cwd();
  return resolve(base, raw);
}

export function createDirImportPlugin(): BunPlugin {
  return {
    name: "freeanima-dir-import",
    setup(build) {
      // 整串 `dir:./foo`（默认 namespace）
      build.onResolve({ filter: /^dir:/ }, (args) => {
        const absDir = resolveDirPath(args.path, args.importer);
        return { path: absDir, namespace: "dir" };
      });
      // Bun 拆成 namespace=dir、path=./foo 时
      build.onResolve({ filter: /.*/, namespace: "dir" }, (args) => {
        const absDir = resolveDirPath(args.path, args.importer);
        return { path: absDir, namespace: "dir" };
      });

      build.onLoad({ filter: /.*/, namespace: "dir" }, (args) => {
        if (!existsSync(args.path) || !statSync(args.path).isDirectory()) {
          return {
            contents: buildDirImportModuleSource([]),
            loader: "ts",
          };
        }
        const entries = listDirImportEntries(args.path);
        return {
          contents: buildDirImportModuleSource(entries),
          loader: "ts",
        };
      });
    },
  };
}
