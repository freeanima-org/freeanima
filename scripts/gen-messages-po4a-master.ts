#!/usr/bin/env bun
/**
 * Sync messages/po4a/en.xml from messages/en.json (po4a XML master).
 */
import { readMessageJson, writeMessagesPo4aMaster, messagesEnPath } from "./messages-i18n-lib.ts";

const en = readMessageJson(messagesEnPath);
writeMessagesPo4aMaster(en);
console.log(`gen-messages-po4a-master: ${Object.keys(en).length} keys → messages/po4a/en.xml`);
