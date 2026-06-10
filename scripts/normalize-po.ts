#!/usr/bin/env bun
/**
 * Normalize po/<lang>/*.po: relative #: refs + Language header.
 */
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DOC_PO_LANGS, poLangDir, poRoot, type DocPoLang } from "./docs-i18n-lib.ts";

const root = join(import.meta.dir, "..");

function normalizeLang(lang: DocPoLang): void {
  const dir = poLangDir(lang);
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".po")) continue;
    const path = join(dir, name);
    let content = readFileSync(path, "utf8");
    content = content.replaceAll(`${root}/`, "");
    content = content.replace(/"Language: \\n"/, `"Language: ${lang}\\n"`);
    writeFileSync(path, content);
  }
}

for (const lang of DOC_PO_LANGS) {
  normalizeLang(lang);
}

if (existsSync(poRoot)) {
  for (const name of readdirSync(poRoot)) {
    if (name.endsWith(".pot") || /\.[a-z]{2}_[A-Z]{2}\.po$/i.test(name)) {
      unlinkSync(join(poRoot, name));
    }
  }
}

console.log("normalize-po: ok");
