#!/usr/bin/env bun
/**
 * Unified po4a pipeline: docs + Paraglide UI messages.
 * 1. Generate po4a.cfg / messages/po4a/en.xml
 * 2. Run po4a to update POT/PO and write translations
 * 3. Compile messages/zh-cn.json (consumed by Paraglide)
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("bun", ["scripts/gen-po4a-cfg.ts"]);
run("bun", ["scripts/gen-messages-po4a-master.ts"]);
run("po4a", ["po4a.cfg"]);
run("bun", ["scripts/compile-messages-from-po4a.ts"]);

console.log("i18n-po4a: ok");
