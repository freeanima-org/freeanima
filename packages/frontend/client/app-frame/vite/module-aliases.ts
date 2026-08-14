import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Alias, Plugin } from "vite";

/** 与 tsconfig.base.json paths 手动对齐 */
export const MODULE_ALIAS_RULES = {
  freeanima: "@freeanima/* → packages/{shared,habitat,frontend}/…",
} as const;

export function tsconfigPathEntries(): Record<string, string[]> {
  return {
    "@freeanima/shared": ["./packages/shared/index.ts"],
    "@freeanima/shared/*": ["./packages/shared/*"],
    "@freeanima/habitat/*": ["./packages/habitat/*"],
    "@freeanima/client/*": ["./packages/frontend/client/*"],
    "@freeanima/ui-kit": ["./packages/frontend/ui-kit/index.ts"],
    "@freeanima/ui-kit/*": ["./packages/frontend/ui-kit/*"],
    "@freeanima/features/*": ["./packages/frontend/features/*", "./packages/habitat/features/*"],
    "@freeanima/portal/*": ["./packages/frontend/portal/*", "./packages/habitat/portal/*"],
  };
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

/** 解析 `@freeanima/<subpath>` → 绝对路径（features/portal 双包） */
export function resolveFreeanimaId(repoRoot: string, id: string): string | null {
  if (!id.startsWith("@freeanima/")) return null;
  const subpath = id.slice("@freeanima/".length);
  const candidates: string[] = [];

  if (subpath === "shared" || subpath.startsWith("shared/")) {
    candidates.push(join(repoRoot, "packages", subpath === "shared" ? "shared/index.ts" : subpath));
  } else if (subpath.startsWith("habitat/")) {
    candidates.push(join(repoRoot, "packages", subpath));
  } else if (subpath.startsWith("client/")) {
    candidates.push(join(repoRoot, "packages/frontend", subpath));
  } else if (subpath === "ui-kit" || subpath.startsWith("ui-kit/")) {
    candidates.push(
      join(repoRoot, "packages/frontend", subpath === "ui-kit" ? "ui-kit/index.ts" : subpath),
    );
  } else if (subpath.startsWith("features/")) {
    const rest = subpath.slice("features/".length);
    candidates.push(
      join(repoRoot, "packages/frontend/features", rest),
      join(repoRoot, "packages/habitat/features", rest),
    );
  } else if (subpath.startsWith("portal/")) {
    const rest = subpath.slice("portal/".length);
    candidates.push(
      join(repoRoot, "packages/frontend/portal", rest),
      join(repoRoot, "packages/habitat/portal", rest),
    );
  } else {
    candidates.push(
      join(repoRoot, "packages/shared", subpath),
      join(repoRoot, "packages/habitat", subpath),
      join(repoRoot, "packages/frontend", subpath),
    );
  }

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
 * Vite resolve.alias — 与历史调用兼容；双包解析走 {@link freeanimaResolvePlugin}。
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
