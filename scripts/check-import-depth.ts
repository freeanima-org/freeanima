#!/usr/bin/env bun
/**
 * 相对 import 深度：最多 `../../`；禁止 `../../../` 及以上。
 * 禁止经相对路径进入 `src/` 段（应使用 `@freeanima/*`）。
 *
 *   bun scripts/check-import-depth.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");
const SCAN_DIRS = ["src", "scripts", "tests"] as const;
const SOURCE_EXT = /\.(ts|tsx)$/;
const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const MAX_PARENT_DEPTH = 2;

type Violation = { file: string; spec: string; reason: string };

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".turbo" || entry === ".tsout")
        continue;
      walk(full, out);
      continue;
    }
    if (SOURCE_EXT.test(entry)) out.push(full);
  }
}

function parentDepth(spec: string): number {
  if (!spec.startsWith(".")) return 0;
  const match = /^(\.\.\/)+/.exec(spec);
  if (!match) return 0;
  return match[0].length / 3;
}

function checkSpec(spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const depth = parentDepth(spec);
  if (depth > MAX_PARENT_DEPTH) {
    return `超过 ${MAX_PARENT_DEPTH} 级父目录（${"../".repeat(depth)}）；请改用 @freeanima/*`;
  }
  if (/(?:\.\.\/)+src\//.test(spec)) {
    return "禁止相对路径 `../src/`；请改用 @freeanima/*";
  }
  return null;
}

function collectViolations(filePath: string): Violation[] {
  const text = readFileSync(filePath, "utf-8");
  const violations: Violation[] = [];
  const rel = relative(REPO_ROOT, filePath);
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (!spec) continue;
    const reason = checkSpec(spec);
    if (reason) violations.push({ file: rel, spec, reason });
  }
  return violations;
}

const files: string[] = [];
for (const dir of SCAN_DIRS) {
  walk(join(REPO_ROOT, dir), files);
}

const all = files.flatMap(collectViolations);
if (all.length > 0) {
  console.error(`import-depth: ${all.length} violation(s)`);
  for (const v of all.slice(0, 40)) {
    console.error(`  ${v.file}: ${v.spec}`);
    console.error(`    → ${v.reason}`);
  }
  if (all.length > 40) console.error(`  … and ${all.length - 40} more`);
  process.exit(1);
}

console.log(`import-depth: ok (${files.length} files)`);
