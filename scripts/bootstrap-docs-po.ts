#!/usr/bin/env bun
/**
 * Bootstrap po/<lang>/<master>.po from English master + Chinese reference.
 * Prefers docs/.generated/zh_CN/, falls back to docs/.zh-cn-ref/.
 */
import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  DOC_PO_LANGS,
  ensurePoLayout,
  generatedZhRoot,
  listDocMasters,
  poFilePath,
  poPotPath,
  poRoot,
  zhRefRoot,
} from "./docs-i18n-lib.ts";

const root = join(import.meta.dir, "..");

ensurePoLayout();

function resolveLocalized(relFromDocs: string): string | null {
  const generated = join(generatedZhRoot, relFromDocs);
  if (existsSync(generated)) return generated;
  const ref = join(zhRefRoot, relFromDocs);
  if (existsSync(ref)) return ref;
  return null;
}

let count = 0;
for (const { abs: master, master: slug, rel } of listDocMasters()) {
  const relFromDocs = relative(join(root, "docs"), master);
  const localized = resolveLocalized(relFromDocs);
  if (!localized) {
    console.error(`bootstrap-docs-po: missing zh reference for ${rel}`);
    process.exit(1);
  }

  for (const lang of DOC_PO_LANGS) {
    if (lang !== "zh_CN") continue;
    const po = poFilePath(slug, lang);
    const pot = poPotPath(slug);
    if (!existsSync(pot)) writeFileSync(pot, "");

    const r = spawnSync(
      "po4a-gettextize",
      [
        "--format",
        "text",
        "-o",
        "markdown",
        "-o",
        "yfm_keys=title",
        "-o",
        "yfm_lenient",
        "--master",
        master,
        "--localized",
        localized,
        "--po",
        po,
      ],
      { cwd: root, encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.error(r.stderr || r.stdout);
      process.exit(1);
    }

    spawnSync("msgattrib", ["--clear-fuzzy", "--no-obsolete", "-o", po, po], { cwd: root });
    count += 1;
  }
}

spawnSync("bun", ["scripts/normalize-po.ts"], { cwd: root, stdio: "inherit" });

const legacyPo = join(poRoot, "zh_CN.po");
if (existsSync(legacyPo)) unlinkSync(legacyPo);

console.log(`bootstrap-docs-po: wrote ${count} files under po/zh_CN/`);
