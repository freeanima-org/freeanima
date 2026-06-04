/**
 * 禁止相对 import 带 .js/.jsx/.mjs/.cjs 后缀（源码均为 .ts/.tsx，由 Bun/tsgo 解析）。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const SCAN_ROOTS = [
  "kernel",
  "engine",
  "capabilities",
  "connectors",
  "packages",
  "apps",
  "scripts",
  "tests",
] as const;

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo"]);

/** from "./module" / import("./module") — 仅相对路径 */
const RELATIVE_JS_IMPORT =
  /(?:\bfrom\s+|\bimport\s*\()\s*['"](\.\.?\/[^'"]+\.(?:js|jsx|mjs|cjs))['"]/g;

type Violation = { file: string; specifier: string; line: number };

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (/\.(ts|tsx|mts)$/.test(name)) out.push(abs);
  }
}

function scanFile(abs: string): Violation[] {
  const text = readFileSync(abs, "utf-8");
  const rel = relative(repoRoot, abs);
  const lines = text.split("\n");
  const hits: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const m of line.matchAll(RELATIVE_JS_IMPORT)) {
      hits.push({ file: rel, specifier: m[1]!, line: i + 1 });
    }
  }
  return hits;
}

const files: string[] = [];
for (const root of SCAN_ROOTS) {
  walk(join(repoRoot, root), files);
}

const violations = files.flatMap(scanFile);

if (violations.length === 0) {
  console.log(`check-import-extensions: OK (${files.length} files)`);
  process.exit(0);
}

console.error("相对 import 不应带 .js 等后缀（源码为 .ts/.tsx）：\n");
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.specifier}`);
}
console.error(`\n共 ${violations.length} 处。请改为无后缀路径（如 ./foo 而不是 ./foo.js）`);
process.exit(1);
