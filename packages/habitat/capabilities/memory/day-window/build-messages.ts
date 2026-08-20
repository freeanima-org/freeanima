/**
 * CST 日窗与会话块收集：供 retain / temporal / reflect / autobiography 共用。
 * （目录原 light-sleep；浅睡生产路径已拆除。）
 */
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { CST_OFFSET_MS } from "@freeanima/habitat/core/util";
import type { LimbicMemoryRow, SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import { getConversationMetaLite, listMessages } from "@freeanima/habitat/core/db/pg/conversation";
import { listLimbicMemoryBySession } from "@freeanima/habitat/core/db/pg/limbic-memory";
import {
  ORGANIZE_MEMORY_FIELDS,
  renderSemanticMemoryList,
  toSemanticMemoryPromptItem,
} from "@freeanima/habitat/core/hooks/prompt";
import { filterRecallableMessages } from "../message-filter.ts";

/** @deprecated 历史名；语义为 CST 日窗 */
export type LightSleepDayRange = {
  day: string;
  fromIso: string;
  toIso: string;
};

export type DayWindowRange = LightSleepDayRange;

/** CST calendar-day boundary [fromIso, toIso) */
export function cstDayRange(day?: string): DayWindowRange {
  const now = new Date(Date.now() + CST_OFFSET_MS);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  let d = now.getUTCDate();

  if (day) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
    if (match) {
      y = Number(match[1]);
      m = Number(match[2]) - 1;
      d = Number(match[3]);
    }
  } else {
    // At 02:00 runtime, default to the CST calendar day that just ended
    const prev = new Date(Date.UTC(y, m, d) - 24 * 60 * 60 * 1000);
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth();
    d = prev.getUTCDate();
  }

  const dayStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const fromIso = `${dayStr}T00:00:00+08:00`;
  const next = new Date(Date.UTC(y, m, d + 1));
  const toIso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}T00:00:00+08:00`;
  return { day: dayStr, fromIso, toIso };
}

export type LightSleepConversationBlock = {
  conversationId: string;
  title: string;
  platform: string;
  updatedAt: string;
  text: string;
};

const MAX_DIALOGUE_CHARS = 120_000;

function roleLabel(role: string): string {
  return role === "user" ? "User" : "Agent";
}

/** Keep messages whose timestamp falls in [fromIso, toIso). Invalid timestamps are dropped. */
export function filterMessagesInDayRange<T extends { t: string }>(
  messages: T[],
  range: LightSleepDayRange,
): T[] {
  const fromMs = Date.parse(range.fromIso);
  const toMs = Date.parse(range.toIso);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return [];
  return messages.filter((msg) => {
    const ms = Date.parse(msg.t);
    return Number.isFinite(ms) && ms >= fromMs && ms < toMs;
  });
}

export async function collectConversationBlocks(
  conversationIds: string[],
  range: LightSleepDayRange,
): Promise<LightSleepConversationBlock[]> {
  const blocks: LightSleepConversationBlock[] = [];
  for (const conversationId of conversationIds) {
    let meta;
    try {
      meta = await getConversationMetaLite(conversationId);
    } catch (e) {
      logComponent("memory").warn("skip conversation: meta parse failed", {
        conversation_id: conversationId,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    if (!meta) continue;
    const messages = filterMessagesInDayRange(
      filterRecallableMessages(await listMessages(conversationId)),
      range,
    );
    if (messages.length === 0) continue;

    const lines = [`## Conversation ${conversationId}`];
    const title = meta.title?.trim();
    const platform = meta.platform ?? "unknown";
    const updatedAt = meta.timestamp ?? "";
    lines.push(
      `(platform=${platform}${title ? `, title=${title}` : ""}, updated ${updatedAt.slice(0, 19)})`,
    );
    lines.push("");
    for (const msg of messages) {
      const ts = msg.t.slice(0, 19) || "?";
      lines.push(`${ts} ${roleLabel(msg.role)}: ${msg.content}`);
    }

    blocks.push({
      conversationId,
      title: title ?? "",
      platform,
      updatedAt,
      text: lines.join("\n"),
    });
  }
  return blocks;
}

export function formatDialogueMessage(blocks: LightSleepConversationBlock[]): {
  text: string;
  truncatedConversations: number;
} {
  if (blocks.length === 0) {
    return { text: "(No valid dialogue for this day)", truncatedConversations: 0 };
  }

  let total = 0;
  const selected: LightSleepConversationBlock[] = [];
  for (const block of blocks) {
    const next = total + block.text.length + 2;
    if (next > MAX_DIALOGUE_CHARS && selected.length > 0) break;
    selected.push(block);
    total = next;
  }

  const truncatedConversations = blocks.length - selected.length;
  const header = `# Today's dialogue (${selected.length} session(s))`;
  let body = selected.map((b) => b.text).join("\n\n");
  if (truncatedConversations > 0) {
    body += `\n\n[Truncated ${truncatedConversations} session(s) — context budget exceeded]`;
  }
  return { text: `${header}\n\n${body}`, truncatedConversations };
}

export function formatExistingMemoriesMessage(rows: SemanticMemoryRow[]): string {
  return renderSemanticMemoryList(rows.map(toSemanticMemoryPromptItem), {
    fields: ORGANIZE_MEMORY_FIELDS,
  }).text;
}

/** retain 任务规格（层 2）：抽取 + 防重复轻对照（非整表整理） */
export const RETAIN_TASK_SPEC = `从给定会话原文抽取值得长期保留的事实；对照已注入的少量「本对话相关 / 语义相关」记忆，用 create / update 避免近重复。
勿再检索；以工具返回的 ok 为准，勿被开场相关记忆列表覆盖。
记忆类型：world / experience / opinion / observation / preference / procedural / imprint。
防重复：仅与已注入的策展相关记忆比较；同义则 update 或跳过；全新则 create。全量合并 / 跨会话整理交给 reflect，勿在本 run 做大规模 deprecate。
本 run 内同一 id 成功写入后勿再 create/update/deprecate（除非上次 error）。
工具：memory_semantic_create / memory_semantic_update / memory_semantic_deprecate（deprecate 仅当策展列表中条目已明显失效）。
对话消息带 role（user/assistant）与 t（发送时间）：按说话人区分人物归属，勿把 assistant 的话当成用户事实（除非明确在描述用户）。
observed_at = 事实首次被提及的消息时间（可参考 t）；occurred_at = 内容描述的事件时间（可模糊）。
既有记忆以 <memory> 属性为准（id / type / sources / observed / occurred）。
写完后输出约 20 字总结收尾，勿再调工具。`;

/** @deprecated 使用 RETAIN_TASK_SPEC + composeAutoLlmPrompt */
export const RETAIN_INSTRUCTION_MESSAGE = RETAIN_TASK_SPEC;

/** @deprecated 使用 RETAIN_INSTRUCTION_MESSAGE */
export const LIGHT_SLEEP_INSTRUCTION_MESSAGE = RETAIN_INSTRUCTION_MESSAGE;

export async function collectLimbicMemoriesForSessions(
  conversationIds: string[],
): Promise<LimbicMemoryRow[]> {
  const byId = new Map<string, LimbicMemoryRow>();
  for (const conversationId of conversationIds) {
    const rows = await listLimbicMemoryBySession(conversationId);
    for (const row of rows) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

export function formatLimbicMemoriesMessage(rows: LimbicMemoryRow[]): string {
  if (rows.length === 0) {
    return "(No existing limbic memories overlapping these sessions)";
  }
  const lines = [`# Existing limbic memories (${rows.length})`];
  for (const row of rows) {
    const semanticIds =
      row.semantic_memory_ids.length > 0 ? `[${row.semantic_memory_ids.join(", ")}]` : "[]";
    lines.push(
      `[${row.id}] (${row.kind}) session=${row.conversation_id} intensity=${row.intensity} semantic=${semanticIds}`,
    );
    lines.push(row.content);
    lines.push("");
  }
  return lines.join("\n").trim();
}
