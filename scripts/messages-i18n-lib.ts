import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

export const messagesEnPath = join(root, "messages/en.json");
export const messagesZhPath = join(root, "messages/zh-cn.json");
export const messagesPo4aDir = join(root, "messages/po4a");
export const messagesPo4aMasterPath = join(messagesPo4aDir, "en.xml");
export const messagesGeneratedZhXmlPath = join(root, "messages/.generated/zh_CN.xml");
export const messagesZhRefPath = join(root, "messages/.zh-cn-ref/zh.xml");

/** po4a $master basename for messages/po4a/en.xml */
export const MESSAGES_PO4A_MASTER = "en.xml";

export type MessageCatalog = Record<string, string>;

export function readMessageJson(path: string): MessageCatalog {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const out: MessageCatalog = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "$schema") continue;
    if (typeof value !== "string") {
      throw new Error(`${path}: expected string for key ${key}`);
    }
    out[key] = value;
  }
  return out;
}

function escapeXml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function unescapeXml(text: string): string {
  return text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

export function sortedMessageKeys(catalog: MessageCatalog): string[] {
  return Object.keys(catalog).toSorted();
}

/** po4a XML master: each <msg id="key"> is one translatable string (placeholders {…} are safe). */
export function catalogToPo4aXml(catalog: MessageCatalog): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<messages>"];
  for (const key of sortedMessageKeys(catalog)) {
    lines.push(`  <msg id="${key}">${escapeXml(catalog[key])}</msg>`);
  }
  lines.push("</messages>");
  return `${lines.join("\n")}\n`;
}

export function po4aXmlToCatalog(xml: string): MessageCatalog {
  const out: MessageCatalog = {};
  const re = /<msg id="([^"]+)">([\s\S]*?)<\/msg>/g;
  for (const match of xml.matchAll(re)) {
    const [, id, body] = match;
    if (!id) continue;
    out[id] = unescapeXml(body ?? "");
  }
  return out;
}

export function writeMessagesPo4aMaster(catalog: MessageCatalog): void {
  mkdirSync(messagesPo4aDir, { recursive: true });
  writeFileSync(messagesPo4aMasterPath, catalogToPo4aXml(catalog), "utf8");
}

export function writeParaglideZhJson(
  en: MessageCatalog,
  zh: MessageCatalog,
  schema?: string,
): void {
  const raw = JSON.parse(readFileSync(messagesEnPath, "utf8")) as Record<string, unknown>;
  const out: Record<string, string> = {};
  if (schema) out.$schema = schema;
  else if (typeof raw.$schema === "string") out.$schema = raw.$schema;

  for (const key of sortedMessageKeys(en)) {
    const value = zh[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`compile-messages: missing translation for key ${key}`);
    }
    out[key] = value;
  }
  writeFileSync(messagesZhPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
}

export function ensureMessagesGeneratedDir(): void {
  mkdirSync(join(root, "messages/.generated"), { recursive: true });
}

export function resolveMessagesZhXml(): string | null {
  if (existsSync(messagesGeneratedZhXmlPath)) return messagesGeneratedZhXmlPath;
  if (existsSync(messagesZhRefPath)) return messagesZhRefPath;
  return null;
}

const PO4A_CONFLICT_RE = /#-#-#-#-#([\s\S]*?)#-#-#-#-#/g;

/** Strip po4a conflict markers written on duplicate msgids; keep the first translation segment. */
export function stripPo4aConflictMarkers(text: string): string {
  if (!text.includes("#-#-#-#-#")) return text;
  const first = PO4A_CONFLICT_RE.exec(text);
  PO4A_CONFLICT_RE.lastIndex = 0;
  if (first) {
    const segment = first[1] ?? "";
    const line = segment
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.includes("messages/") && !l.startsWith("type "));
    if (line) return line;
  }
  return text.replace(PO4A_CONFLICT_RE, "").trim();
}

/**
 * A single English msgid may only have one translation in gettext; use the first zh by key sort order as canonical.
 */
function normalizeZhValue(enVal: string, zhVal: string): string {
  let cleaned = stripPo4aConflictMarkers(zhVal);
  if (!enVal.includes("\n") && cleaned.includes("\n")) {
    const line = cleaned
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (line) cleaned = line;
  }
  return cleaned;
}

export function canonizeZhForPo4a(en: MessageCatalog, zh: MessageCatalog): MessageCatalog {
  const canonical = new Map<string, string>();
  for (const key of sortedMessageKeys(en)) {
    const enVal = en[key];
    if (canonical.has(enVal)) continue;
    const raw = zh[key] ?? "";
    canonical.set(enVal, normalizeZhValue(enVal, raw));
  }
  const out: MessageCatalog = {};
  for (const key of sortedMessageKeys(en)) {
    out[key] = canonical.get(en[key]) ?? "";
  }
  return out;
}

export function assertNoPo4aConflictMarkers(catalog: MessageCatalog, label: string): void {
  for (const [key, value] of Object.entries(catalog)) {
    if (value.includes("#-#-#-#-#")) {
      throw new Error(`${label}: po4a conflict markers in key ${key}`);
    }
  }
}
