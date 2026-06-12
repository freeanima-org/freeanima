#!/usr/bin/env bun
/**
 * One-shot layer restructure: move directories + rename @freeanima/* packages in imports and package.json.
 * Run from repo root: bun scripts/layer-restructure.ts
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

/** Longest-first replacement for @freeanima imports and package names */
const PKG_RENAMES: [string, string][] = [
  ["@freeanima/capabilities-llm-openai", "@freeanima/capabilities-llm-openai"],
  ["@freeanima/storage-provider-llm", "@freeanima/storage-provider-llm"],
  ["@freeanima/orchestration-conversation", "@freeanima/orchestration-conversation"],
  [
    "@freeanima/mechanism-tool/session-conversation-port",
    "@freeanima/mechanism-tool/session-conversation-port",
  ],
  ["@freeanima/storage-tokenizer", "@freeanima/storage-tokenizer"],
  ["@freeanima/orchestration-session", "@freeanima/orchestration-session"],
  ["@freeanima/storage-config", "@freeanima/storage-config"],
  ["@freeanima/storage-repos", "@freeanima/storage-repos"],
  ["@freeanima/orchestration-turn", "@freeanima/orchestration-turn"],
  ["@freeanima/mechanism-compress", "@freeanima/mechanism-compress"],
  ["@freeanima/mechanism-hooks", "@freeanima/mechanism-hooks"],
  ["@freeanima/orchestration-loop", "@freeanima/orchestration-loop"],
  ["@freeanima/mechanism-hooks", "@freeanima/mechanism-hooks"],
  ["@freeanima/mechanism-tool", "@freeanima/mechanism-tool"],
  ["@freeanima/mechanism-llm", "@freeanima/mechanism-llm"],
  ["@freeanima/mechanism-skill", "@freeanima/mechanism-skill"],
  ["@freeanima/storage-util", "@freeanima/storage-util"],
  ["@freeanima/storage-db", "@freeanima/storage-db"],
  ["@freeanima/capabilities-memory", "@freeanima/capabilities-memory"],
  ["@freeanima/capabilities-estate", "@freeanima/capabilities-estate"],
  ["@freeanima/capabilities-identity", "@freeanima/capabilities-identity"],
  ["@freeanima/service-commands", "@freeanima/service-commands"],
  ["@freeanima/orchestration-runtime", "@freeanima/orchestration-runtime"],
];

const PATH_RENAMES: [string, string][] = [
  ["storage/", "storage/"],
  ["mechanism/", "mechanism/"],
  ["orchestration/runtime/", "orchestration/runtime/"],
  ["orchestration/", "orchestration/"],
  ["capabilities/identity/", "capabilities/identity/"],
  ["capabilities/memory/", "capabilities/memory/"],
  ["service/commands/", "service/commands/"],
];

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".git"]);

function moveDir(from: string, to: string): void {
  const absFrom = join(ROOT, from);
  const absTo = join(ROOT, to);
  if (!existsSync(absFrom)) {
    console.log(`skip missing: ${from}`);
    return;
  }
  if (existsSync(absTo)) {
    console.log(`skip exists: ${to}`);
    return;
  }
  const parent = join(absTo, "..");
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
  renameSync(absFrom, absTo);
  console.log(`moved ${from} → ${to}`);
}

function walkFiles(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkFiles(abs, out);
    else if (/\.(ts|tsx|json|md|mdc|sql|toml|yaml|yml|sh)$/.test(name)) out.push(abs);
  }
}

function replaceInFile(abs: string): boolean {
  let content = readFileSync(abs, "utf-8");
  let orig = content;

  for (const [from, to] of PATH_RENAMES.sort((a, b) => b[0].length - a[0].length)) {
    content = content.split(from).join(to);
  }

  for (const [from, to] of PKG_RENAMES) {
    content = content.split(from).join(to);
  }

  // Legacy package constant strings
  content = content.replace(/@freeanima\/life-self/g, "@freeanima/capabilities-identity");
  content = content.replace(/CAPABILITIES_IDENTITY_PACKAGE/g, "CAPABILITIES_IDENTITY_PACKAGE");
  content = content.replace(/@freeanima\/life-memory/g, "@freeanima/capabilities-memory");
  content = content.replace(/@freeanima\/life-estate/g, "@freeanima/capabilities-estate");
  content = content.replace(/CAPABILITIES_ESTATE_PACKAGE/g, "CAPABILITIES_ESTATE_PACKAGE");

  if (content !== orig) {
    writeFileSync(abs, content);
    return true;
  }
  return false;
}

function moveFoundationPackages(): void {
  const base = join(ROOT, "engine/foundation");
  if (!existsSync(base)) return;
  for (const name of readdirSync(base)) {
    moveDir(`storage/${name}`, `storage/${name}`);
  }
  rmEmpty(`engine/foundation`);
  rmEmpty(`engine`);
}

function moveMechanismPackages(): void {
  const base = join(ROOT, "engine/mechanism");
  if (!existsSync(base)) return;
  for (const name of readdirSync(base)) {
    if (name === "prompt") continue;
    moveDir(`mechanism/${name}`, `mechanism/${name}`);
  }
  rmEmpty(`engine/mechanism`);
}

function moveOrchestrationPackages(): void {
  const base = join(ROOT, "engine/orchestration");
  if (!existsSync(base)) return;
  for (const name of readdirSync(base)) {
    if (name === "engine") {
      moveDir(`orchestration/engine`, `orchestration/runtime`);
      continue;
    }
    moveDir(`orchestration/${name}`, `orchestration/${name}`);
  }
  rmEmpty(`engine/orchestration`);
  rmEmpty(`engine`);
}

function rmEmpty(rel: string): void {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return;
  if (readdirSync(abs).length === 0) rmSync(abs, { recursive: true });
}

function updatePackageNames(): void {
  const dirs = [
    "kernel",
    "storage",
    "mechanism",
    "orchestration",
    "capabilities",
    "connectors",
    "service",
    "cli",
    "tests",
  ];
  for (const top of dirs) {
    const base = join(ROOT, top);
    if (!existsSync(base)) continue;
    const entries =
      top === "cli" || top === "tests"
        ? [{ name: ".", isDirectory: () => true }]
        : readdirSync(base, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const pkgDir = top === "cli" || top === "tests" ? base : join(base, ent.name);
      const pj = join(pkgDir, "package.json");
      if (!existsSync(pj)) continue;
      replaceInFile(pj);
      if (top === "cli" || top === "tests") break;
    }
  }
}

function main(): void {
  console.log("=== Phase 1: directory moves ===");
  moveFoundationPackages();
  moveMechanismPackages();
  moveOrchestrationPackages();
  moveDir("life/self", "capabilities/identity");
  moveDir("life/memory", "capabilities/memory");
  moveDir("connectors/commands", "service/commands");
  rmEmpty("life");

  if (existsSync(join(ROOT, "connectors/sqlite"))) {
    rmSync(join(ROOT, "connectors/sqlite"), { recursive: true });
    console.log("removed connectors/sqlite");
  }

  console.log("=== Phase 2: text replacements ===");
  const files: string[] = [];
  walkFiles(ROOT, files);
  let n = 0;
  for (const f of files) {
    const rel = relative(ROOT, f);
    if (rel.startsWith("node_modules/")) continue;
    if (replaceInFile(f)) n++;
  }
  console.log(`updated ${n} files`);

  console.log("=== Phase 3: package.json names ===");
  updatePackageNames();

  console.log("done — run: bun install && bun run check");
}

main();
