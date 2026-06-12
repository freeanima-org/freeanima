#!/usr/bin/env bun
/**
 * Phase 4: merge capabilities clarify+estate → tools; fridge-magnet+mask → tasks.
 */
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

const REPLACEMENTS: [string, string][] = [
  ["@freeanima/capabilities-tools/clarify", "@freeanima/capabilities-tools/clarify"],
  ["@freeanima/capabilities-tools/estate", "@freeanima/capabilities-tools/estate"],
  ["@freeanima/capabilities-tasks/fridge-magnet", "@freeanima/capabilities-tasks/fridge-magnet"],
  ["@freeanima/capabilities-tasks/mask", "@freeanima/capabilities-tasks/mask"],
];

const MERGES: [string, string, string][] = [
  ["capabilities/clarify/src", "capabilities/tools/src/clarify", "clarify"],
  ["capabilities/estate/src", "capabilities/tools/src/estate", "estate"],
  ["capabilities/fridge-magnet/src", "capabilities/tasks/src/fridge-magnet", "fridge-magnet"],
  ["capabilities/mask/src", "capabilities/tasks/src/mask", "mask"],
];

const REMOVE_PKGS = ["clarify", "estate", "fridge-magnet", "mask"];

function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) copyDir(src, dst);
    else cpSync(src, dst);
  }
}

function replaceAll(content: string): string {
  let out = content;
  for (const [a, b] of REPLACEMENTS) out = out.split(a).join(b);
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === "dist") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json)$/.test(n)) out.push(p);
  }
}

function patchPkgDeps(abs: string): void {
  const j = JSON.parse(readFileSync(abs, "utf-8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const key of ["dependencies", "devDependencies"] as const) {
    const deps = j[key];
    if (!deps) continue;
    for (const dep of Object.keys({ ...deps })) {
      if (REPLACEMENTS.some(([from]) => dep === from)) delete deps[dep];
    }
    j[key] = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
  }
  writeFileSync(abs, JSON.stringify(j, null, 2) + "\n");
}

function main(): void {
  for (const [fromRel, toRel] of MERGES) {
    copyDir(join(ROOT, fromRel), join(ROOT, toRel));
  }

  const toolsPj = JSON.parse(readFileSync(join(ROOT, "capabilities/tools/package.json"), "utf-8"));
  toolsPj.exports = {
    ".": "./src/index.ts",
    "./clarify": "./src/clarify/index.ts",
    "./estate": "./src/estate/index.ts",
    "./*": "./src/*.ts",
  };
  writeFileSync(
    join(ROOT, "capabilities/tools/package.json"),
    JSON.stringify(toolsPj, null, 2) + "\n",
  );

  const tasksPj = JSON.parse(readFileSync(join(ROOT, "capabilities/tasks/package.json"), "utf-8"));
  tasksPj.exports = {
    ".": "./src/index.ts",
    "./fridge-magnet": "./src/fridge-magnet/index.ts",
    "./mask": "./src/mask/index.ts",
    "./*": "./src/*.ts",
  };
  writeFileSync(
    join(ROOT, "capabilities/tasks/package.json"),
    JSON.stringify(tasksPj, null, 2) + "\n",
  );

  const files: string[] = [];
  walk(ROOT, files);
  let n = 0;
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (REMOVE_PKGS.some((p) => rel.startsWith(`capabilities/${p}/`))) continue;
    if (f.endsWith("package.json")) {
      patchPkgDeps(f);
      n++;
      continue;
    }
    const orig = readFileSync(f, "utf-8");
    const next = replaceAll(orig);
    if (next !== orig) {
      writeFileSync(f, next);
      n++;
    }
  }

  for (const pkg of REMOVE_PKGS) {
    rmSync(join(ROOT, "capabilities", pkg), { recursive: true, force: true });
  }

  console.log(`merged capabilities; updated ${n} files; removed ${REMOVE_PKGS.join(", ")}`);
}

main();
