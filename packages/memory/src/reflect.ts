import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/kernel";
import { callReflectChat } from "./reflect-llm.js";
import { createFact, type FactData } from "./fact.js";
import { l2SessionPath } from "./clean.js";
import { getStore } from "./store.js";
import {
  factExtractionSchema,
  l2LineSchema,
  reflectStateSchema,
  type L2Line,
} from "@freeanima/kernel";
import { parseJsonLine, safeParseOrNull } from "@freeanima/kernel";

const EXTRACT_SYSTEM_PROMPT = `你是一位专业的记忆提取助手。你的任务是从一段对话中提取重要信息，存入长期记忆系统。

你可以提取以下类型的信息：
- fact: 事实性陈述（"张三偏好精炼直接的沟通"）
- entity: 实体定义（"逸灵风是数字生命的容器"）
- relation: 实体间关系（"张三是逸灵风的伙伴"）
- reflection: 反思/模式归纳（"对话模式：张三倾向于先讨论概念再讨论实现"）

提取规则：
1. 只提取**有长期价值**的信息。琐碎的问候、确认、过程性对话不要提取。
2. 一条事实应该是一句精炼的陈述，可以被直接放入上下文中理解。
3. 伙伴说出的偏好/习惯/修正 → 高重要度（0.7+）。
4. 数字生命学到的新知识/教训 → 中等重要度（0.5+）。
5. 反复出现的主题/模式 → 类型为 reflection。
6. 置信度：说了就是 0.6，反复确认 0.8，铁律级 1.0。
7. 召回率：只有对大多数对话都相关的才设为高值（0.8+）。
8. 识别对话中出现的实体（人物、项目、工具、概念），每条事实可关联多个实体。

输出格式为 JSON：
{
  "facts": [
    {
      "content": "事实内容（一句话精炼）",
      "type": "fact",
      "domains": ["relationship"],
      "entities": ["张三"],
      "confidence": 0.8,
      "importance": 0.7,
      "recall": 0.6
    }
  ],
  "summary": "这段对话的核心主题一句话。"
}

如果没有值得提取的信息，返回 {"facts": [], "summary": ""}
只返回 JSON，不要其他文字。`;

const EXTRACT_INCREMENTAL_PROMPT = `你是一位专业的记忆提取助手。这是对话的**新增部分**（上次提取后的新内容）。

**重要规则**：
1. 只从「新增对话」部分提取记忆，不要重复提取已经提取过的内容。
2. 前面的「上下文」仅供参考，帮助你理解新增部分的背景。
3. 提取标准同上（只提取有长期价值的信息，一条事实一句精炼陈述）。
4. 如果新增部分没有值得提取的信息，返回 {"facts": [], "summary": ""}。

输出格式与之前相同（JSON）。只返回 JSON，不要其他文字。`;

function reflectStatePath(): string {
  return join(PATHS.home, "runtime", "reflect_state.json");
}

function readReflectState(): Record<string, { last_reflected_t?: string }> {
  const p = reflectStatePath();
  if (!existsSync(p)) return {};
  try {
    const raw: unknown = JSON.parse(readFileSync(p, "utf-8"));
    return safeParseOrNull(reflectStateSchema, raw) ?? {};
  } catch {
    return {};
  }
}

function writeReflectState(state: Record<string, { last_reflected_t?: string }>): void {
  mkdirSync(join(PATHS.home, "runtime"), { recursive: true });
  writeFileSync(reflectStatePath(), JSON.stringify(state, null, 2), "utf-8");
}

function parseL2Messages(l2Text: string): L2Line[] {
  const messages: L2Line[] = [];
  for (const line of l2Text.split("\n")) {
    const record = parseJsonLine(line, l2LineSchema);
    if (!record) continue;
    if (record.type === "meta") continue;
    messages.push(record);
  }
  return messages;
}

function formatFullInput(messages: L2Line[]): string {
  return messages
    .map((m) => {
      const role = m.role === "user" ? "张三" : "Agent";
      return `${role}: ${m.content ?? ""}`;
    })
    .join("\n");
}

function buildIncrementalInput(sessionId: string, l2Text: string): string | null {
  const messages = parseL2Messages(l2Text);
  if (!messages.length) return null;

  const state = readReflectState();
  const lastT = state[sessionId]?.last_reflected_t ?? "";

  if (!lastT) return formatFullInput(messages);

  const newMsgs = messages.filter((m) => (m.t ?? "") > lastT);
  if (newMsgs.length < 2) return null;

  let lastNewIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    if ((messages[i]!.t ?? "") > lastT) lastNewIdx = i;
  }
  const contextStart = Math.max(0, lastNewIdx - 6);
  const contextMsgs = messages.slice(contextStart, lastNewIdx + 1);

  const parts = ["## 上下文（对话历史末尾）"];
  for (const m of contextMsgs) {
    const role = m.role === "user" ? "张三" : "Agent";
    parts.push(`${role}: ${m.content ?? ""}`);
  }
  if (contextMsgs.length < messages.length) {
    parts.push("");
    parts.push("## 新增对话（上次提取后的新内容，请从这里提取记忆）");
    for (const m of newMsgs) {
      const role = m.role === "user" ? "张三" : "Agent";
      parts.push(`${role}: ${m.content ?? ""}`);
    }
  }
  return parts.join("\n");
}

function updateReflectState(sessionId: string, l2Text: string): void {
  let lastT = "";
  for (const line of l2Text.split("\n")) {
    const record = parseJsonLine(line, l2LineSchema);
    if (!record) continue;
    if (record.type === "meta") continue;
    const ts = record.t ?? "";
    if (ts) lastT = ts;
  }
  if (!lastT) return;
  const state = readReflectState();
  state[sessionId] = { last_reflected_t: lastT };
  writeReflectState(state);
}

function asStrList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((v) => v.trim());
}

function normalizeFactItem(item: unknown): Record<string, unknown> | null {
  if (typeof item === "string") {
    const content = item.trim();
    return content ? { type: "fact", content } : null;
  }
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const d = item as Record<string, unknown>;
  const content = String(d.content ?? "").trim();
  if (!content) return null;
  return {
    type: String(d.type ?? "fact").trim() || "fact",
    content,
    domains: asStrList(d.domains),
    entities: asStrList(d.entities),
    confidence: d.confidence ?? 0.6,
    importance: d.importance ?? 0.5,
    recall: d.recall ?? 0.3,
  };
}

function parseExtraction(raw: string): Record<string, unknown>[] {
  let text = raw;
  const jsonMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?```/.exec(raw);
  if (jsonMatch) text = jsonMatch[1]!;

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.split("\n").slice(1).join("\n");
    if (cleaned.endsWith("```")) cleaned = cleaned.replace(/```\s*$/, "");
    try {
      data = JSON.parse(cleaned.trim());
    } catch {
      return [];
    }
  }

  const toParse = Array.isArray(data) ? { facts: data, summary: "" } : data;
  const extraction = safeParseOrNull(factExtractionSchema, toParse);
  if (!extraction) return [];

  const facts = extraction.facts;
  if (!Array.isArray(facts)) return [];

  const normalized: Record<string, unknown>[] = [];
  for (const item of facts) {
    const f = normalizeFactItem(item);
    if (f) normalized.push(f);
  }
  return normalized;
}

async function extractWithLlm(l2Text: string, incremental: boolean): Promise<Record<string, unknown>[]> {
  const maxChars = 8000;
  let input = l2Text;
  if (input.length > maxChars) input = `${input.slice(0, maxChars)}\n\n[... 截断]`;

  const systemPrompt = incremental ? EXTRACT_INCREMENTAL_PROMPT : EXTRACT_SYSTEM_PROMPT;
  const userPrompt = incremental
    ? `请从以下对话的「新增部分」中提取记忆：\n\n${input}`
    : `请从以下对话中提取记忆：\n\n${input}`;

  try {
    const resp = await callReflectChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const raw = String(resp.content ?? "");
    if (!raw) return [];
    return parseExtraction(raw);
  } catch {
    return [];
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function contentEqual(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function normalizeContent(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "");
}

/** 若合并到已有事实则返回其 id，否则 null */
function dedupBeforeWrite(
  store: ReturnType<typeof getStore>,
  newFact: FactData,
): string | null {
  const existing = store.search(newFact.content);
  for (const ef of existing) {
    if (contentEqual(ef.content, newFact.content)) {
      ef.confidence = Math.max(ef.confidence, newFact.confidence);
      ef.importance = Math.max(ef.importance, newFact.importance);
      for (const s of newFact.sources) {
        if (!ef.sources.some((x) => JSON.stringify(x) === JSON.stringify(s))) {
          ef.sources.push(s);
        }
      }
      store.update(ef);
      return ef.id;
    }
  }

  const normNew = normalizeContent(newFact.content);
  if (normNew) {
    for (const ef of store.filter()) {
      if (normalizeContent(ef.content) === normNew) {
        ef.confidence = Math.max(ef.confidence, newFact.confidence);
        ef.importance = Math.max(ef.importance, newFact.importance);
        for (const s of newFact.sources) {
          if (!ef.sources.some((x) => JSON.stringify(x) === JSON.stringify(s))) {
            ef.sources.push(s);
          }
        }
        store.update(ef);
        return ef.id;
      }
    }
  }
  return null;
}

export type ReflectSessionResult = { written: number; fact_ids: string[] };

export async function reflectSession(
  sessionId: string,
  l2Text?: string | null,
): Promise<ReflectSessionResult> {
  let text = l2Text ?? null;
  if (text === null || text === undefined) {
    const path = l2SessionPath(sessionId);
    if (!existsSync(path)) return { written: 0, fact_ids: [] };
    text = readFileSync(path, "utf-8");
  }
  text = text.trim();
  if (!text) return { written: 0, fact_ids: [] };

  const incrementalInput = buildIncrementalInput(sessionId, text);
  if (!incrementalInput) return { written: 0, fact_ids: [] };

  const factsData = await extractWithLlm(incrementalInput, true);
  if (!factsData.length) {
    updateReflectState(sessionId, text);
    return { written: 0, fact_ids: [] };
  }

  const store = getStore();
  let written = 0;
  const factIds: string[] = [];
  for (const item of factsData) {
    const fact = createFact({
      type: String(item.type ?? "fact"),
      content: String(item.content ?? ""),
      domains: asStrList(item.domains),
      entities: asStrList(item.entities),
      confidence: clamp01(Number(item.confidence ?? 0.6)),
      importance: clamp01(Number(item.importance ?? 0.5)),
      recall: clamp01(Number(item.recall ?? 0.3)),
      sources: [{ session: sessionId, summary: text.slice(0, 100) }],
    });
    if (!fact.content) continue;
    const mergedId = dedupBeforeWrite(store, fact);
    if (mergedId) {
      factIds.push(mergedId);
      continue;
    }
    const id = store.create(fact);
    factIds.push(id);
    written++;
  }

  updateReflectState(sessionId, text);
  return { written, fact_ids: factIds };
}
