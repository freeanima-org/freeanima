#!/usr/bin/env bun
/**
 * Warn when doc PO msgstr still equals English msgid (likely missing translation).
 * Skips fenced code blocks and entries without letters.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { poLangDir } from "./docs-i18n-lib.ts";

const root = join(import.meta.dir, "..");
const strict = process.argv.includes("--strict");
const langDir = poLangDir("zh_CN");

function fail(message: string): never {
  console.error(`check-po-english-msgstr: ${message}`);
  process.exit(1);
}

function warn(message: string): void {
  console.warn(`check-po-english-msgstr: warning: ${message}`);
}

/** Brand / protocol tokens allowed to stay English in msgstr. */
const ALLOW_PREFIX = [
  "http://",
  "https://",
  "**http://",
  "`anima ",
  "`chmod ",
  "[`satellites/",
  "[`packages/",
];
const ALLOW = new Set([
  "GitHub",
  "English",
  "Console",
  "Docker Compose",
  "MIT",
  "Gateway",
  "MCP",
  "ACP",
]);

type Entry = { file: string; type: string; msgid: string };

function parseEntries(content: string, file: string): Entry[] {
  const out: Entry[] = [];
  for (const block of content.split(/\n\n(?=#\.|$)/)) {
    if (!block.includes("msgid ")) continue;
    const type = block.match(/^#\. type: ([^\n]+)/m)?.[1] ?? "";
    if (type.includes("Fenced code block") || type.includes("Code fence")) continue;

    const idMultiline = block.match(/^msgid ""\n((?:"[^"]*"\n?)+)/m);
    const strMultiline = block.match(/^msgstr ""\n((?:"[^"]*"\n?)+)/m);
    if (idMultiline) {
      const idBody = idMultiline[1];
      if (!idBody) continue;
      const msgid = idBody
        .replace(/^"|"$/gm, "")
        .replace(/\n/g, "")
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"');
      const strBody = strMultiline?.[1];
      const msgstr = strBody
        ? strBody
            .replace(/^"|"$/gm, "")
            .replace(/\n/g, "")
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
        : "";
      if (
        msgid &&
        msgstr === msgid &&
        /[A-Za-z]{4,}/.test(msgid) &&
        !ALLOW.has(msgid.trim()) &&
        !ALLOW_PREFIX.some((p) => msgid.startsWith(p))
      ) {
        out.push({ file, type, msgid: msgid.slice(0, 80) });
      }
      continue;
    }

    const single = block.match(/^msgid "((?:[^"\\]|\\.)*)"\nmsgstr "((?:[^"\\]|\\.)*)"/m);
    if (!single) continue;
    const msgidRaw = single[1];
    const msgstrRaw = single[2];
    if (msgidRaw === undefined || msgstrRaw === undefined) continue;
    const msgid = msgidRaw.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    const msgstr = msgstrRaw.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    if (
      msgid &&
      msgstr === msgid &&
      /[A-Za-z]{4,}/.test(msgid) &&
      !ALLOW.has(msgid.trim()) &&
      !ALLOW_PREFIX.some((p) => msgid.startsWith(p)) &&
      !msgid.includes("redis:7-alpine")
    ) {
      out.push({ file, type, msgid: msgid.slice(0, 80) });
    }
  }
  return out;
}

const docPoFiles = readdirSync(langDir)
  .filter((name) => name.endsWith(".md.po"))
  .map((name) => join(langDir, name));

const hits: Entry[] = [];
for (const path of docPoFiles) {
  const rel = relative(root, path);
  hits.push(...parseEntries(readFileSync(path, "utf8"), rel));
}

if (hits.length > 0) {
  for (const { file, type, msgid } of hits.slice(0, 30)) {
    const line = `${file} [${type}]: ${msgid.replace(/\n/g, "\\n")}`;
    if (strict) fail(line);
    warn(line);
  }
  if (hits.length > 30) {
    const message = `… and ${hits.length - 30} more English msgstr entries`;
    if (strict) fail(message);
    warn(message);
  }
}

console.log(
  `check-po-english-msgstr: ok (${hits.length} English msgstr ${strict ? "errors" : "warnings"} in ${docPoFiles.length} doc PO files)`,
);
