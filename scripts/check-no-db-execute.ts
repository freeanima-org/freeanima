#!/usr/bin/env bun
/**
 * Fail if core/src/db/pg or tests/integration contain db.execute or drizzleSql.raw.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SCAN_DIRS = [join(ROOT, "src/core/db/pg"), join(ROOT, "tests/integration")];
const PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bdb\.execute\b/, label: "db.execute" },
  { re: /\bdrizzleSql\.raw\b/, label: "drizzleSql.raw" },
];

type Hit = { file: string; line: number; label: string; text: string };

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    out.push(path);
  }
}

function scanFile(path: string): Hit[] {
  const hits: Hit[] = [];
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (text === undefined) continue;
    for (const { re, label } of PATTERNS) {
      if (re.test(text)) {
        hits.push({ file: path, line: i + 1, label, text: text.trim() });
      }
    }
  }
  return hits;
}

function main(): void {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    walk(dir, files);
  }

  const hits = files.flatMap(scanFile);
  if (hits.length === 0) {
    console.log("check-no-db-execute: OK (no db.execute or drizzleSql.raw)");
    return;
  }

  console.error("check-no-db-execute: forbidden patterns found:\n");
  for (const hit of hits) {
    console.error(`  ${relative(ROOT, hit.file)}:${hit.line}  [${hit.label}]  ${hit.text}`);
  }
  console.error(
    `\n${hits.length} violation(s). Use Drizzle ORM select/insert/update/delete with sql fragments instead.`,
  );
  process.exit(1);
}

main();
