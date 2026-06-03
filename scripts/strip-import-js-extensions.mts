#!/usr/bin/env bun
/** 将相对路径 import/export 中的 .js 后缀去掉（仅 ./ ../ 开头） */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".ts") || name.endsWith(".mts")) out.push(p);
  }
}

/** 静态 from/export、动态 import()、require()、typeof import() */
const REL =
  /((?:from|export)\s+["']|(?:import|require)\(\s*["']|typeof\s+import\(\s*["']|doMock\(\s*["']|doUnmock\(\s*["'])(\.\.?\/[^"']+)\.js(["'])/g;

const files: string[] = [];
walk(ROOT, files);
let changed = 0;
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const next = raw.replace(REL, "$1$2$3");
  if (next !== raw) {
    writeFileSync(file, next);
    changed++;
  }
}
console.log(JSON.stringify({ files: files.length, changed }));
