#!/usr/bin/env bun
/**
 * Require `-- reason` on oxlint-disable / eslint-disable directive lines.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SCAN_DIRS = [
  "kernel",
  "core",
  "runtime",
  "capabilities",
  "platform",
  "packages",
  "satellites",
  "app",
  "scripts",
  "tests",
];
const IGNORE_PATH_PARTS = [
  "/node_modules/",
  "/dist/",
  "/coverage/",
  "/.tsout/",
  "/app/cli/publish/",
  "routeTree.gen.ts",
];
const DIRECTIVE_RE = /(?:oxlint|eslint)-disable(?:-next-line|-line)?/;
const REASON_RE = /--\s+\S/;

type Hit = { file: string; line: number; text: string };

function shouldSkip(path: string): boolean {
  return IGNORE_PATH_PARTS.some((part) => path.includes(part));
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (shouldSkip(path)) continue;
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path, out);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) continue;
    out.push(path);
  }
}

function scanFile(path: string): Hit[] {
  const hits: Hit[] = [];
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (text === undefined) continue;
    if (!DIRECTIVE_RE.test(text)) continue;
    if (REASON_RE.test(text)) continue;
    hits.push({ file: path, line: i + 1, text: text.trim() });
  }
  return hits;
}

function main(): void {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    const abs = join(ROOT, dir);
    try {
      walk(abs, files);
    } catch {
      // optional dir
    }
  }

  const hits = files.flatMap(scanFile);
  if (hits.length === 0) {
    console.log("check-lint-disable-reason: OK");
    return;
  }

  console.error("check-lint-disable-reason: disable directives must include `-- reason`:\n");
  for (const hit of hits) {
    console.error(`  ${relative(ROOT, hit.file)}:${hit.line}  ${hit.text}`);
  }
  process.exit(1);
}

main();
