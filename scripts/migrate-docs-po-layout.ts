#!/usr/bin/env bun
/**
 * Migrate legacy layout po/<master>.{pot,zh_CN.po} → po/pot/<master>.pot + po/zh_CN/<master>.po
 */
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ensurePoLayout, poRoot, potRoot } from "./docs-i18n-lib.ts";

ensurePoLayout();

if (!existsSync(poRoot)) {
  console.log("migrate-docs-po-layout: no po/ directory");
  process.exit(0);
}

let movedPot = 0;
let movedPo = 0;

for (const name of readdirSync(poRoot)) {
  const src = join(poRoot, name);
  if (name.endsWith(".pot")) {
    renameSync(src, join(potRoot, name));
    movedPot += 1;
    continue;
  }
  const poMatch = name.match(/^(.+)\.([a-z]{2}_[A-Z]{2})\.po$/);
  if (poMatch) {
    const [, master, lang] = poMatch;
    if (!master || !lang) continue;
    const langDir = join(poRoot, lang);
    mkdirSync(langDir, { recursive: true });
    renameSync(src, join(langDir, `${master}.po`));
    movedPo += 1;
  }
}

const legacyPo = join(poRoot, "zh_CN.po");
if (existsSync(legacyPo)) unlinkSync(legacyPo);
const legacyPot = join(poRoot, "freeanima.pot");
if (existsSync(legacyPot)) unlinkSync(legacyPot);

console.log(`migrate-docs-po-layout: moved ${movedPot} POT → po/pot/, ${movedPo} PO → po/zh_CN/`);
