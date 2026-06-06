import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import type { SessionStorePort } from "@freeanima/engine-repos";
import { callReflectChat } from "./reflect-llm.ts";
import { createSemanticMemory } from "./fact.ts";
import { factExtractionSchema, reflectStateSchema } from "./schemas/l2.ts";
import { filterRecallableMessages, type RecallableMessage } from "./message-filter.ts";
import { getMemorySessionStore } from "./session-port.ts";
import { getSemanticMemoryStore } from "./semantic-port.ts";
import { safeParseOrNull } from "@freeanima/kernel-util";

const EXTRACT_SYSTEM_PROMPT = `你是一位专业的记忆提取助手。你的任务是从一段对话中提取重要信息，存入长期语义记忆。

可提取的记忆类型：
- world: 客观事实与知识（"逸灵风是数字生命的容器"）
- experience: Agent 自身的第一人称行为记录
- opinion: 主观判断
- observation: 对人物/事物的综合观察
- preference: 偏好与习惯（"张三偏好精炼直接的沟通"）
- procedural: 如何做某事的知识
- imprint: 值得保留的情感印记（只追加）

提取规则：
1. 只提取**有长期价值**的信息。琐碎的问候、确认、过程性对话不要提取。
2. 一条记忆应该是一句精炼的陈述，可以被直接放入上下文中理解。
3. 伙伴说出的偏好/习惯/修正 → type=preference，可考虑 pinned 语义（由你判断是否在 content 中体现重要性）。
4. 数字生命学到的新知识/教训 → type=world 或 experience。
5. 反复出现的主题/模式 → type=observation。

输出格式为 JSON：
{
  "facts": [
    {
      "content": "记忆内容（一句话精炼）",
      "type": "preference"
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
3. 提取标准同上（只提取有长期价值的信息，一条记忆一句精炼陈述）。
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

function formatFullInput(messages: RecallableMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role === "user" ? "张三" : "Agent";
      return `${role}: ${m.content}`;
    })
    .join("\n");
}

function buildIncrementalInput(sessionId: string, messages: RecallableMessage[]): string | null {
  if (!messages.length) return null;

  const state = readReflectState();
  const lastT = state[sessionId]?.last_reflected_t ?? "";

  if (!lastT) return formatFullInput(messages);

  const newMsgs = messages.filter((m) => m.t > lastT);
  if (newMsgs.length < 2) return null;

  let lastNewIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]!.t > lastT) lastNewIdx = i;
  }
  const contextStart = Math.max(0, lastNewIdx - 6);
  const contextMsgs = messages.slice(contextStart, lastNewIdx + 1);

  const parts = ["## 上下文（对话历史末尾）"];
  for (const m of contextMsgs) {
    const role = m.role === "user" ? "张三" : "Agent";
    parts.push(`${role}: ${m.content}`);
  }
  if (contextMsgs.length < messages.length) {
    parts.push("");
    parts.push("## 新增对话（上次提取后的新内容，请从这里提取记忆）");
    for (const m of newMsgs) {
      const role = m.role === "user" ? "张三" : "Agent";
      parts.push(`${role}: ${m.content}`);
    }
  }
  return parts.join("\n");
}

function updateReflectState(sessionId: string, messages: RecallableMessage[]): void {
  let lastT = "";
  for (const m of messages) {
    if (m.t) lastT = m.t;
  }
  if (!lastT) return;
  const state = readReflectState();
  state[sessionId] = { last_reflected_t: lastT };
  writeReflectState(state);
}

function normalizeFactItem(item: unknown): { content: string; type?: string } | null {
  if (typeof item === "string") {
    const content = item.trim();
    return content ? { content, type: "world" } : null;
  }
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const d = item as Record<string, unknown>;
  const content = String(d.content ?? "").trim();
  if (!content) return null;
  return {
    content,
    type: String(d.type ?? "world").trim() || "world",
  };
}

function parseExtraction(raw: string): Array<{ content: string; type?: string }> {
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

  const normalized: Array<{ content: string; type?: string }> = [];
  for (const item of facts) {
    const f = normalizeFactItem(item);
    if (f) normalized.push(f);
  }
  return normalized;
}

async function extractWithLlm(
  input: string,
  incremental: boolean,
): Promise<Array<{ content: string; type?: string }>> {
  const maxChars = 8000;
  let text = input;
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}\n\n[... 截断]`;

  const systemPrompt = incremental ? EXTRACT_INCREMENTAL_PROMPT : EXTRACT_SYSTEM_PROMPT;
  const userPrompt = incremental
    ? `请从以下对话的「新增部分」中提取记忆：\n\n${text}`
    : `请从以下对话中提取记忆：\n\n${text}`;

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

/** 若合并到已有记忆则返回其 id，否则 null */
async function dedupBeforeWrite(content: string): Promise<string | null> {
  const store = getSemanticMemoryStore();
  const exact = await store.findByContent(content);
  if (exact) return exact.id;
  return null;
}

export type ReflectSessionResult = { written: number; fact_ids: string[] };

const REFLECT_MESSAGE_WINDOW = 300;

async function loadMessagesForReflect(
  store: SessionStorePort,
  sessionId: string,
): Promise<RecallableMessage[]> {
  const total = await store.countMessages(sessionId);
  if (total <= REFLECT_MESSAGE_WINDOW) {
    return filterRecallableMessages(await store.listMessages(sessionId));
  }
  const offset = total - REFLECT_MESSAGE_WINDOW;
  const page = await store.listMessagesPage(sessionId, offset, REFLECT_MESSAGE_WINDOW);
  return filterRecallableMessages(page);
}

export async function reflectSession(
  sessionId: string,
  sessionStore?: SessionStorePort,
): Promise<ReflectSessionResult> {
  const store = sessionStore ?? getMemorySessionStore();
  const messages = await loadMessagesForReflect(store, sessionId);
  if (!messages.length) return { written: 0, fact_ids: [] };

  const incrementalInput = buildIncrementalInput(sessionId, messages);
  if (!incrementalInput) return { written: 0, fact_ids: [] };

  const factsData = await extractWithLlm(incrementalInput, true);
  if (!factsData.length) {
    updateReflectState(sessionId, messages);
    return { written: 0, fact_ids: [] };
  }

  const memoryStore = getSemanticMemoryStore();
  let written = 0;
  const factIds: string[] = [];
  for (const item of factsData) {
    const draft = createSemanticMemory({
      type: item.type,
      content: item.content,
    });
    if (!draft.content) continue;
    const mergedId = await dedupBeforeWrite(draft.content);
    if (mergedId) {
      factIds.push(mergedId);
      continue;
    }
    const id = await memoryStore.create({
      content: draft.content,
      type: draft.type,
      pinned: draft.pinned,
    });
    factIds.push(id);
    written++;
  }

  updateReflectState(sessionId, messages);
  return { written, fact_ids: factIds };
}
