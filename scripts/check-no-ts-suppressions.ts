#!/usr/bin/env bun
/**
 * Forbid ts-ignore / ts-nocheck directives; ts-expect-error must include an explanation on the same line.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const TS_IGNORE = ["@", "ts-ignore"].join("");
const TS_NOCHECK = ["@", "ts-nocheck"].join("");
const TS_EXPECT = ["@", "ts-expect-error"].join("");
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

type Hit = { file: string; line: number; label: string; text: string };

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
    if (text.includes(TS_IGNORE)) {
      hits.push({ file: path, line: i + 1, label: "ts-ignore", text: text.trim() });
      continue;
    }
    if (text.includes(TS_NOCHECK)) {
      hits.push({ file: path, line: i + 1, label: "ts-nocheck", text: text.trim() });
      continue;
    }
    const expectIdx = text.indexOf(TS_EXPECT);
    if (expectIdx >= 0) {
      const tail = text.slice(expectIdx + TS_EXPECT.length).trim();
      if (tail.length === 0) {
        hits.push({
          file: path,
          line: i + 1,
          label: "ts-expect-error without reason",
          text: text.trim(),
        });
      }
    }
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
    console.log("check-no-ts-suppressions: OK");
    return;
  }

  console.error("check-no-ts-suppressions: forbidden or undocumented TS suppressions:\n");
  for (const hit of hits) {
    console.error(`  ${relative(ROOT, hit.file)}:${hit.line}  [${hit.label}]  ${hit.text}`);
  }
  process.exit(1);
}

main();
