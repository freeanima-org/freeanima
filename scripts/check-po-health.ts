#!/usr/bin/env bun
/**
 * Docs PO / po4a health check (po/pot/*.pot + po/<lang>/*.po).
 *
 * Default warn: allow fuzzy (English ahead, translations catching up).
 * --strict: fail when fuzzy entries exist.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  DOC_PO_LANGS,
  generatedZhRoot,
  listDocMasters,
  listPoFilesForLang,
  poFilePath,
  poPotPath,
} from "./docs-i18n-lib.ts";
import { MESSAGES_PO4A_MASTER } from "./messages-i18n-lib.ts";

const root = join(import.meta.dir, "..");
const strict = process.argv.includes("--strict");

function fail(message: string): never {
  console.error(`check-po-health: ${message}`);
  process.exit(1);
}

function warn(message: string): void {
  console.warn(`check-po-health: warning: ${message}`);
}

const masters = listDocMasters();

for (const lang of DOC_PO_LANGS) {
  const poFiles = listPoFilesForLang(lang);
  if (poFiles.length === 0) {
    fail(`no po/${lang}/*.po files; run bootstrap-docs-po.ts`);
  }

  const requiredMasters = [...masters.map((m) => m.master), MESSAGES_PO4A_MASTER];
  for (const master of requiredMasters) {
    const po = poFilePath(master, lang);
    const pot = poPotPath(master);
    if (!existsSync(po)) fail(`missing ${po}`);
    if (!existsSync(pot)) fail(`missing ${pot}`);
  }

  let totalFuzzy = 0;
  let totalTranslated = 0;
  let totalUntranslated = 0;

  for (const po of poFiles) {
    const fuzzy = spawnSync("msgattrib", ["--only-fuzzy", "--no-obsolete", po], {
      encoding: "utf8",
    });
    if (fuzzy.status !== 0) {
      fail(`msgattrib failed for ${po}: ${fuzzy.stderr}`);
    }
    totalFuzzy += (fuzzy.stdout.match(/^msgid /gm) ?? []).length;

    const stats = spawnSync("msgfmt", ["--statistics", po], { encoding: "utf8" });
    if (stats.status !== 0) {
      fail(`msgfmt failed for ${po}: ${stats.stderr}`);
    }
    const m = stats.stderr.match(/(\d+) translated message/);
    const u = stats.stderr.match(/(\d+) untranslated message/);
    totalTranslated += m ? Number(m[1]) : 0;
    totalUntranslated += u ? Number(u[1]) : 0;
  }

  if (totalFuzzy > 0) {
    const message = `${totalFuzzy} fuzzy entries in po/${lang}/ (English updated, translations pending review)`;
    if (strict) fail(message);
    warn(message);
  }

  process.stdout.write(
    `check-po-health: [${lang}] ${totalTranslated} translated, ${totalUntranslated} untranslated (${poFiles.length} PO files)\n`,
  );
}

const po4a = spawnSync("po4a", ["po4a.cfg"], { cwd: root, encoding: "utf8" });
if (po4a.status !== 0) {
  fail(`po4a failed: ${po4a.stderr || po4a.stdout}`);
}

for (const { rel } of masters) {
  const relFromDocs = rel.replace(/^docs\//, "");
  const out = join(generatedZhRoot, relFromDocs);
  if (!existsSync(out)) {
    fail(`missing generated doc: docs/.generated/zh_CN/${relFromDocs}`);
  }
}

const messagesOut = join(root, "messages/.generated/zh_CN.xml");
if (!existsSync(messagesOut)) {
  fail("missing generated messages: messages/.generated/zh_CN.xml");
}

const po4aCfg = readFileSync(join(root, "po4a.cfg"), "utf8");
const docEntries = (po4aCfg.match(/^\[type: docmd\]/gm) ?? []).length;
const xmlEntries = (po4aCfg.match(/^\[type: xml\]/gm) ?? []).length;
if (docEntries !== masters.length || xmlEntries !== 1) {
  warn(
    `po4a.cfg has ${docEntries} docmd + ${xmlEntries} xml entries; run bun scripts/gen-po4a-cfg.ts`,
  );
}

const generatedCheck = spawnSync("bun", ["scripts/check-generated-docs-i18n.ts"], {
  cwd: root,
  encoding: "utf8",
  stdio: "pipe",
});
if (generatedCheck.status !== 0) {
  fail(generatedCheck.stdout || generatedCheck.stderr || "check-generated-docs-i18n failed");
}

const englishCheck = spawnSync("bun", ["scripts/check-po-english-msgstr.ts"], {
  cwd: root,
  encoding: "utf8",
  stdio: "pipe",
});
if (englishCheck.status !== 0) {
  fail(englishCheck.stdout || englishCheck.stderr || "check-po-english-msgstr failed");
}
if (englishCheck.stdout) {
  process.stdout.write(englishCheck.stdout);
}

console.log(`check-po-health: ok (${strict ? "strict" : "warn"} mode)`);
