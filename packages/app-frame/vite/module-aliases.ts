import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertNarrow } from "@freeanima/shared/assert-narrow.ts";
import { isRecord } from "@freeanima/shared/util";
import type { Alias, Plugin } from "vite";

const MODULE_ALIASES_DIR = dirname(fileURLToPath(import.meta.url));

/** 仓库根（`packages/app-frame/vite/` → 上溯三级）。 */
export const REPO_ROOT = resolve(MODULE_ALIASES_DIR, "../../..");

/**
 * `@freeanima/*` → 仓库相对路径，**同源**于 `tsconfig.base.json` 的 `paths`。
 *
 * 直接读文件而不是手抄一份：此前这里手抄的映射残留了 `./packages/frontend/*`
 * 之类的退役路径并与 tsconfig 漂移。一致性（含「目标目录存在」）由
 * `module-aliases.test.ts` 断言。
 */
export function tsconfigPathEntries(repoRoot: string = REPO_ROOT): Record<string, string[]> {
  const raw = readFileSync(join(repoRoot, "tsconfig.base.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  const compilerOptions = assertNarrow<{ paths?: Record<string, string[]> } | undefined>(
    isRecord(parsed) ? parsed.compilerOptions : undefined,
  );
  return compilerOptions?.paths ?? {};
}

export type BuildViteAliasesOptions = {
  repoRoot: string;
};

/**
 * 解析候选路径为可加载文件。
 * 不可用 `path.includes(".")` 判断扩展名：worktree 常在 `~/.cursor/...` 下，整路径含点会误判目录。
 */
function tryFile(base: string): string | null {
  if (existsSync(base)) {
    if (statSync(base).isDirectory()) {
      const asDirIndex = join(base, "index.ts");
      if (existsSync(asDirIndex)) return asDirIndex;
      const asDirIndexTsx = join(base, "index.tsx");
      if (existsSync(asDirIndexTsx)) return asDirIndexTsx;
      return null;
    }
    return base;
  }
  if (existsSync(`${base}.ts`)) return `${base}.ts`;
  if (existsSync(`${base}.tsx`)) return `${base}.tsx`;
  if (existsSync(join(base, "index.ts"))) return join(base, "index.ts");
  if (existsSync(join(base, "index.tsx"))) return join(base, "index.tsx");
  return null;
}

/** 解析 `@freeanima/<subpath>` → 绝对路径（单规则，与 tsconfig.base.json 同源） */
export function resolveFreeanimaId(repoRoot: string, id: string): string | null {
  if (!id.startsWith("@freeanima/")) return null;
  const subpath = id.slice("@freeanima/".length);
  const candidates: string[] = [];
  const at = (...segments: string[]): string => join(repoRoot, "packages", ...segments);

  // 单一规则：`@freeanima/<pkg>/<sub>` → `packages/<pkg>/<sub>`（目录 barrel 由 tryFile 兜底 index.ts）
  candidates.push(
    at(subpath === "shared" || subpath === "ui-kit" ? `${subpath}/index.ts` : subpath),
  );

  for (const c of candidates) {
    const hit = tryFile(c);
    if (hit) return hit;
  }
  return null;
}

export function freeanimaResolvePlugin(repoRoot: string): Plugin {
  return {
    name: "freeanima-resolve",
    enforce: "pre",
    resolveId(id) {
      return resolveFreeanimaId(repoRoot, id);
    },
  };
}

/**
 * Vite resolve.alias — 与历史调用兼容；真实解析走 {@link freeanimaResolvePlugin}。
 * 仍提供简单 alias，便于仅用 alias 的调用方；推荐同时挂 plugin。
 */
export function buildViteAliases(opts: BuildViteAliasesOptions): Alias[] {
  const { repoRoot } = opts;
  return [
    {
      find: /^@freeanima\/(.*)$/,
      replacement: join(repoRoot, "packages/shared") + "/$1",
      customResolver(updatedId) {
        // updatedId is absolute from replacement; recover subpath
        const marker = `${join(repoRoot, "packages/shared")}/`;
        let sub = updatedId.startsWith(marker) ? updatedId.slice(marker.length) : updatedId;
        const resolved = resolveFreeanimaId(repoRoot, `@freeanima/${sub}`);
        return resolved ?? undefined;
      },
    },
  ];
}
