#!/usr/bin/env bun
/**
 * Generate po4a.cfg: split mode; POT under po/pot/, per-language PO under po/<lang>/.
 * Docs → text (markdown mode); Paraglide UI → xml (messages/po4a/en.xml).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertUniqueMasters,
  DOC_PO_LANGS,
  listDocMasters,
  PO4A_DOCMD_ALIAS,
} from "./docs-i18n-lib.ts";

const root = join(import.meta.dir, "..");
const masters = listDocMasters();
assertUniqueMasters(masters);

const lines = [
  `[po4a_langs] ${DOC_PO_LANGS.join(" ")}`,
  "[po4a_paths] po/pot/$master.pot $lang:po/$lang/$master.po",
  "",
  "[options] --master-charset utf-8 --keep 0",
  "",
  PO4A_DOCMD_ALIAS,
  "",
  ...masters.map(({ rel }) => {
    const out = rel.replace(/^docs\//, "docs/.generated/$lang/");
    return `[type: docmd] ${rel} $lang:${out}`;
  }),
  "",
  "[type: xml] messages/po4a/en.xml $lang:messages/.generated/zh_CN.xml",
  "",
];

writeFileSync(join(root, "po4a.cfg"), `${lines.join("\n")}\n`);
console.log(`gen-po4a-cfg: ${masters.length} doc + 1 messages entries → po4a.cfg`);
