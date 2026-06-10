#!/usr/bin/env bun
/**
 * Bootstrap po/zh_CN/en.xml.po from English XML master + Chinese reference XML.
 * Reference: messages/.generated/zh_CN.xml, else messages/.zh-cn-ref/zh.xml, else messages/zh-cn.json.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensurePoLayout, poFilePath, poPotPath } from "./docs-i18n-lib.ts";
import {
  MESSAGES_PO4A_MASTER,
  canonizeZhForPo4a,
  catalogToPo4aXml,
  messagesEnPath,
  messagesPo4aMasterPath,
  messagesZhPath,
  messagesZhRefPath,
  readMessageJson,
  writeMessagesPo4aMaster,
} from "./messages-i18n-lib.ts";

const root = join(import.meta.dir, "..");

ensurePoLayout();

const en = readMessageJson(messagesEnPath);
writeMessagesPo4aMaster(en);

function resolveZhXml(): string {
  if (existsSync(messagesZhRefPath)) return messagesZhRefPath;
  if (existsSync(messagesZhPath)) {
    mkdirSync(join(root, "messages/.zh-cn-ref"), { recursive: true });
    const zh = canonizeZhForPo4a(en, readMessageJson(messagesZhPath));
    writeFileSync(messagesZhRefPath, catalogToPo4aXml(zh), "utf8");
    return messagesZhRefPath;
  }
  console.error(
    "bootstrap-messages-po: no zh reference (messages/zh-cn.json or messages/.zh-cn-ref/zh.xml)",
  );
  process.exit(1);
}

const localized = resolveZhXml();
const po = poFilePath(MESSAGES_PO4A_MASTER, "zh_CN");
const pot = poPotPath(MESSAGES_PO4A_MASTER);

if (!existsSync(pot)) writeFileSync(pot, "");

const r = spawnSync(
  "po4a-gettextize",
  [
    "--format",
    "xml",
    "--master",
    messagesPo4aMasterPath,
    "--master-charset",
    "UTF-8",
    "--localized",
    localized,
    "--localized-charset",
    "UTF-8",
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
spawnSync("bun", ["scripts/normalize-po.ts"], { cwd: root, stdio: "inherit" });

console.log(`bootstrap-messages-po: wrote ${po}`);
