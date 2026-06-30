#!/usr/bin/env bun
/**
 * Ensure Paraglide message keys match between en and zh-cn, and generated TS types are fresh.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import en from "../messages/en.json" with { type: "json" };
import zh from "../messages/zh-cn.json" with { type: "json" };

const repoRoot = join(import.meta.dir, "..");

function fail(message: string): never {
  console.error(`check-paraglide-messages: ${message}`);
  process.exit(1);
}

const enKeys = Object.keys(en)
  .filter((k) => k !== "$schema")
  .toSorted();
const zhKeys = Object.keys(zh)
  .filter((k) => k !== "$schema")
  .toSorted();

const missingInZh = enKeys.filter((k) => !(k in zh));
const missingInEn = zhKeys.filter((k) => !(k in en));

if (missingInZh.length > 0) {
  fail(`zh-cn.json missing keys: ${missingInZh.join(", ")}`);
}
if (missingInEn.length > 0) {
  fail(`en.json missing keys: ${missingInEn.join(", ")}`);
}

for (const key of enKeys) {
  const value = zh[key as keyof typeof zh];
  if (typeof value !== "string" || value.trim() === "") {
    fail(`zh-cn.json empty value for key: ${key}`);
  }
}

const gen = spawnSync("bun", ["scripts/gen-paraglide-message-types.ts"], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (gen.status !== 0) {
  fail(gen.stderr || gen.stdout || "gen-paraglide-message-types failed");
}
const diff = spawnSync("git", ["diff", "--quiet", "types/paraglide-messages.generated.d.ts"], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (diff.status !== 0) {
  fail(
    "types/paraglide-messages.generated.d.ts is stale; run bun scripts/gen-paraglide-message-types.ts",
  );
}

console.log(`check-paraglide-messages: ok (${enKeys.length} keys)`);
