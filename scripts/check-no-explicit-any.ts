#!/usr/bin/env bun
/**
 * Forbid explicit `any` in contract / port directories.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SCAN_DIRS = [
  join(ROOT, "platform/ports"),
  join(ROOT, "features/console/protocol/admin-contract"),
  join(ROOT, "shared/sap-contract"),
];
const ANY_RE = /:\s*any\b|as\s+any\b|<any>|Promise<any>|Record<string,\s*any>/;

type Hit = { file: string; line: number; text: string };

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (/\.(test|spec)\.ts$/.test(name)) continue;
    out.push(path);
  }
}

function scanFile(path: string): Hit[] {
  const hits: Hit[] = [];
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (text === undefined) continue;
    if (ANY_RE.test(text)) {
      hits.push({ file: path, line: i + 1, text: text.trim() });
    }
  }
  return hits;
}

function main(): void {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    if (!existsSync(dir)) continue;
    walk(dir, files);
  }

  const hits = files.flatMap(scanFile);
  if (hits.length === 0) {
    console.log("check-no-explicit-any: OK (contract dirs)");
    return;
  }

  console.error("check-no-explicit-any: explicit any forbidden in contract dirs:\n");
  for (const hit of hits) {
    console.error(`  ${relative(ROOT, hit.file)}:${hit.line}  ${hit.text}`);
  }
  process.exit(1);
}

main();
