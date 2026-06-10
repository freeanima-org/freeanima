#!/usr/bin/env bun
/**
 * Ensure Paraglide message keys match between en and zh-cn.
 */
import en from "../messages/en.json" with { type: "json" };
import zh from "../messages/zh-cn.json" with { type: "json" };

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

console.log(`check-paraglide-messages: ok (${enKeys.length} keys)`);
