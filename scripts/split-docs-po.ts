#!/usr/bin/env bun
/**
 * One-time migration: split monolithic po/zh_CN.po into per-document po/zh_CN/<master>.po.
 * Entries with multiple #: refs are duplicated into each relevant document PO.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { listDocMasters, masterFilename, poFilePath, poPotPath, poRoot } from "./docs-i18n-lib.ts";

const legacyPo = join(poRoot, "zh_CN.po");

type PoEntry = {
  headerLines: string[];
  bodyLines: string[];
  refs: string[];
};

function parsePo(content: string): { header: string; entries: PoEntry[] } {
  const lines = content.split("\n");
  const entries: PoEntry[] = [];
  let i = 0;
  const headerLines: string[] = [];

  while (i < lines.length) {
    const headerLine = lines[i];
    if (headerLine === undefined) break;
    if (!headerLine.startsWith("#. ") && !headerLine.startsWith("#:")) {
      if (headerLine.startsWith("msgid ") || (headerLine === "" && headerLines.length > 0)) {
        break;
      }
      headerLines.push(headerLine);
      i += 1;
      continue;
    }
    break;
  }

  let current: PoEntry | null = null;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    if (line.startsWith("#. ") || line.startsWith("#,") || line.startsWith("#|")) {
      if (!current) current = { headerLines: [], bodyLines: [], refs: [] };
      current.headerLines.push(line);
      continue;
    }
    if (line.startsWith("#:")) {
      if (!current) current = { headerLines: [], bodyLines: [], refs: [] };
      current.headerLines.push(line);
      const refs = [...line.matchAll(/docs\/[^\s:]+\.md/g)]
        .map((m) => m[0])
        .filter((ref): ref is string => ref !== undefined);
      current.refs.push(...refs);
      continue;
    }
    if (line.startsWith("#~")) {
      continue;
    }
    if (line.startsWith("msgid ") || line.startsWith("msgstr ")) {
      if (!current) current = { headerLines: [], bodyLines: [], refs: [] };
      current.bodyLines.push(line);
      let j = i + 1;
      while (j < lines.length) {
        const contLine = lines[j];
        if (contLine === undefined || !contLine.startsWith('"')) break;
        current.bodyLines.push(contLine);
        j += 1;
      }
      i = j - 1;
      if (
        j >= lines.length ||
        lines[j]?.startsWith("#.") ||
        lines[j]?.startsWith("#:") ||
        lines[j]?.startsWith("msgid ")
      ) {
        entries.push(current);
        current = null;
      }
      continue;
    }
  }
  if (current) entries.push(current);

  const header = headerLines.join("\n");
  return { header, entries };
}

function entryText(entry: PoEntry): string {
  return [...entry.headerLines, ...entry.bodyLines].join("\n");
}

function poHeaderForLang(header: string): string {
  return header.replace(/^"Language: \\n"$/m, '"Language: zh_CN\\n"');
}

if (!existsSync(legacyPo)) {
  console.log("split-docs-po: no po/zh_CN.po, skip");
  process.exit(0);
}

const masters = listDocMasters();
const masterByRel = new Map(masters.map((m) => [m.rel, masterFilename(m.rel)]));
const buckets = new Map<string, PoEntry[]>();
for (const { master } of masters) {
  buckets.set(master, []);
}

const { header, entries } = parsePo(readFileSync(legacyPo, "utf8"));
const poHeader = poHeaderForLang(header);

for (const entry of entries) {
  const docRefs = [...new Set(entry.refs.filter((r) => masterByRel.has(r)))];
  if (docRefs.length === 0) continue;
  for (const ref of docRefs) {
    const slug = masterByRel.get(ref);
    if (!slug) continue;
    const bucket = buckets.get(slug);
    if (!bucket) continue;
    bucket.push(entry);
  }
}

mkdirSync(poRoot, { recursive: true });
for (const { master } of masters) {
  const items = buckets.get(master) ?? [];
  const pot = poPotPath(master);
  if (!existsSync(pot)) writeFileSync(pot, "");

  const chunks = [poHeader, ""];
  for (const entry of items) {
    chunks.push(entryText(entry), "");
  }
  writeFileSync(poFilePath(master), `${chunks.join("\n").trimEnd()}\n`);
}

unlinkSync(legacyPo);
const legacyPot = join(poRoot, "freeanima.pot");
if (existsSync(legacyPot)) unlinkSync(legacyPot);

console.log(`split-docs-po: migrated ${masters.length} document PO files, removed po/zh_CN.po`);
