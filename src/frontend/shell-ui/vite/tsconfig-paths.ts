import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Alias } from "vite";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolvePathTarget(repoRoot: string, target: string): string {
  return join(repoRoot, target);
}

/** 将根 tsconfig paths 转为 Vite alias（单包迁移后无 workspace 包名解析） */
export function createTsconfigPathsAliases(repoRoot: string): Alias[] {
  const raw = readFileSync(join(repoRoot, "tsconfig.json"), "utf-8");
  const tsconfig = JSON.parse(raw) as {
    compilerOptions?: { paths?: Record<string, string[]> };
  };
  const paths = tsconfig.compilerOptions?.paths ?? {};
  const entries = Object.entries(paths).toSorted(([a], [b]) => b.length - a.length);

  const aliases: Alias[] = [];
  for (const [key, targets] of entries) {
    const target = targets[0];
    if (!target) continue;

    if (key.endsWith("/*")) {
      const prefix = key.slice(0, -2);
      if (target.endsWith("/*.ts")) {
        const base = resolvePathTarget(repoRoot, target.slice(0, -5));
        aliases.push({
          find: new RegExp(`^${escapeRegex(prefix)}/(.*)$`),
          replacement: `${base}/$1.ts`,
        });
        continue;
      }
      if (target.endsWith("/*")) {
        const base = resolvePathTarget(repoRoot, target.slice(0, -1));
        aliases.push({
          find: new RegExp(`^${escapeRegex(prefix)}/(.*)$`),
          replacement: `${base}/$1`,
        });
        continue;
      }
    }

    aliases.push({ find: key, replacement: resolvePathTarget(repoRoot, target) });
  }

  return aliases;
}
