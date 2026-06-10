#!/usr/bin/env bun
/**
 * Compile messages/zh-cn.json from po4a output messages/.generated/zh_CN.xml.
 */
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import {
  assertNoPo4aConflictMarkers,
  messagesGeneratedZhXmlPath,
  messagesEnPath,
  readMessageJson,
  po4aXmlToCatalog,
  writeParaglideZhJson,
} from "./messages-i18n-lib.ts";

if (!existsSync(messagesGeneratedZhXmlPath)) {
  console.error(
    "compile-messages-from-po4a: missing messages/.generated/zh_CN.xml; run po4a po4a.cfg first",
  );
  process.exit(1);
}

const en = readMessageJson(messagesEnPath);
const xml = readFileSync(messagesGeneratedZhXmlPath, "utf8");
const zh = po4aXmlToCatalog(xml);
assertNoPo4aConflictMarkers(zh, "messages/.generated/zh_CN.xml");

writeParaglideZhJson(en, zh);
console.log(`compile-messages-from-po4a: ${Object.keys(zh).length} keys → messages/zh-cn.json`);
