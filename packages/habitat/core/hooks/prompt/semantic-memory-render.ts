/**
 * AutoLlm 两类文本：记忆清单 `<memory>`、对话消息 `<message>`。
 * 正文在标签内，归属在属性；属性值经 wrapPromptXml 转义引号。正文不 entity-escape。
 */
import { omitUndefined } from "@freeanima/habitat/core/util";
import { PROMPT_XML_TAGS, wrapPromptXml, type PromptXmlAttrs } from "./xml-wrap.ts";

export type MemoryPromptField = "type" | "sources" | "observed" | "occurred" | "pinned" | "refs";

/** retain / reflect 整理默认字段 */
export const ORGANIZE_MEMORY_FIELDS: readonly MemoryPromptField[] = [
  "type",
  "sources",
  "observed",
  "occurred",
];

/** Working 对话注入：仅 id */
export const CONVERSATION_MEMORY_FIELDS: readonly MemoryPromptField[] = [];

/** 常驻：id + pinned */
export const RESIDENT_MEMORY_FIELDS: readonly MemoryPromptField[] = ["pinned"];

/** self-layer 证据：整理字段 + pinned + refs */
export const SELF_LAYER_MEMORY_FIELDS: readonly MemoryPromptField[] = [
  "type",
  "sources",
  "observed",
  "occurred",
  "pinned",
  "refs",
];

export type SemanticMemoryPromptItem = {
  id: number | string;
  content: string;
  type?: string | null;
  sources?: readonly string[] | null;
  observed?: Date | string | null;
  occurred?: string | null;
  pinned?: boolean;
  refs?: number | null;
};

export type ConversationMessagePromptItem = {
  role: string;
  content: string;
  t?: string | Date | null;
};

export type RenderedMemoryList = {
  text: string;
  includedIds: number[];
};

/** 属性用时间：Date → UTC ISO 秒；字符串截到 19 位（与 temporal `t.slice(0, 19)` 一致） */
export function formatPromptAttrTimestamp(
  raw: Date | string | null | undefined,
): string | undefined {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return undefined;
    return raw.toISOString().slice(0, 19);
  }
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return undefined;
  return s.slice(0, 19);
}

function buildMemoryAttrs(
  item: SemanticMemoryPromptItem,
  fields: readonly MemoryPromptField[],
): PromptXmlAttrs {
  const fieldSet = new Set(fields);
  const attrs: Record<string, string> = { id: String(item.id) };
  if (fieldSet.has("type")) {
    const type = item.type?.trim();
    if (type) attrs.type = type;
  }
  if (fieldSet.has("sources")) {
    const sources = item.sources?.map((s) => s.trim()).filter(Boolean);
    if (sources && sources.length > 0) attrs.sources = sources.join(",");
  }
  if (fieldSet.has("observed")) {
    const observed = formatPromptAttrTimestamp(item.observed);
    if (observed) attrs.observed = observed;
  }
  if (fieldSet.has("occurred")) {
    const occurred = item.occurred?.trim();
    if (occurred) attrs.occurred = occurred;
  }
  if (fieldSet.has("pinned") && item.pinned) attrs.pinned = "true";
  if (fieldSet.has("refs") && item.refs != null) attrs.refs = String(item.refs);
  return attrs;
}

export function renderSemanticMemoryItem(
  item: SemanticMemoryPromptItem,
  opts?: { fields?: readonly MemoryPromptField[] },
): string {
  const content = item.content.trim();
  if (!content) return "";
  const fields = opts?.fields ?? ORGANIZE_MEMORY_FIELDS;
  const attrs = buildMemoryAttrs(item, fields);
  const inline = !content.includes("\n");
  return wrapPromptXml(PROMPT_XML_TAGS.memoryItem, content, { attrs, inline });
}

export function renderSemanticMemoryList(
  items: readonly SemanticMemoryPromptItem[],
  opts?: { fields?: readonly MemoryPromptField[]; maxChars?: number },
): RenderedMemoryList {
  const fields = opts?.fields ?? ORGANIZE_MEMORY_FIELDS;
  const maxChars = opts?.maxChars;
  const lines: string[] = [];
  const includedIds: number[] = [];
  let used = 0;
  for (const item of items) {
    const line = renderSemanticMemoryItem(item, { fields });
    if (!line) continue;
    const next = used === 0 ? line.length : used + 1 + line.length;
    if (maxChars != null && next > maxChars) break;
    lines.push(line);
    used = next;
    const id = Number(item.id);
    if (Number.isInteger(id) && id > 0) includedIds.push(id);
  }
  return { text: lines.join("\n"), includedIds };
}

/** 从 row / MemoryRecord / recall hit 形状收到 prompt item */
export function toSemanticMemoryPromptItem(row: {
  id?: number | string;
  content: string;
  type?: string | null;
  kind?: string | null;
  source_conversations?: readonly string[] | null;
  sources?: readonly string[] | null;
  observed_at?: Date | string | null;
  occurred_at?: string | null;
  pinned?: boolean;
  reference_count?: number | null;
  semantic_memory_id?: number;
}): SemanticMemoryPromptItem {
  return omitUndefined({
    id: row.semantic_memory_id ?? row.id ?? "",
    content: row.content,
    type: row.type ?? row.kind ?? null,
    sources: row.sources ?? row.source_conversations ?? null,
    observed: row.observed_at ?? null,
    occurred: row.occurred_at ?? null,
    pinned: row.pinned,
    refs: row.reference_count ?? undefined,
  });
}

export function renderConversationMessage(item: ConversationMessagePromptItem): string {
  const content = item.content.trim();
  const role = item.role.trim();
  if (!content || !role) return "";
  const attrs: Record<string, string> = { role };
  const t = formatPromptAttrTimestamp(item.t);
  if (t) attrs.t = t;
  const inline = !content.includes("\n");
  return wrapPromptXml(PROMPT_XML_TAGS.message, content, { attrs, inline });
}

export function renderConversationMessageList(
  items: readonly ConversationMessagePromptItem[],
): string {
  return items.map(renderConversationMessage).filter(Boolean).join("\n");
}

/** 从已渲染清单解析 `<memory id>`（debug 注入追踪） */
export function parseRenderedMemoryIds(text: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const match of text.matchAll(/<memory\b[^>]*\bid="(\d+)"/g)) {
    const raw = match[1];
    if (!raw) continue;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
