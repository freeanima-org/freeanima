import { CST_OFFSET_MS } from "@freeanima/kernel-util";
import type { SemanticMemoryRow, SessionStorePort } from "@freeanima/engine-repos";

import { filterRecallableMessages } from "../message-filter.ts";
import { getSemanticMemoryStore } from "../semantic-port.ts";

export type LightSleepDayRange = {
  day: string;
  fromIso: string;
  toIso: string;
};

/** CST 自然日边界 [fromIso, toIso) */
export function cstDayRange(day?: string): LightSleepDayRange {
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
    // 02:00 运行时默认处理「刚结束的 CST 自然日」
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

export type LightSleepSessionBlock = {
  sessionId: string;
  title: string;
  platform: string;
  updatedAt: string;
  text: string;
};

const MAX_DIALOGUE_CHARS = 120_000;

function roleLabel(role: string): string {
  return role === "user" ? "张三" : "Agent";
}

export async function collectSessionBlocks(
  sessionStore: SessionStorePort,
  sessionIds: string[],
): Promise<LightSleepSessionBlock[]> {
  const blocks: LightSleepSessionBlock[] = [];
  for (const sessionId of sessionIds) {
    const meta = await sessionStore.getSessionMetaLite(sessionId);
    if (!meta || meta.role !== "session_meta") continue;
    const messages = filterRecallableMessages(await sessionStore.listMessages(sessionId));
    if (!messages.length) continue;

    const lines = [`## Session ${sessionId}`];
    const title = meta.title?.trim();
    const platform = meta.platform ?? "unknown";
    const updatedAt = meta.timestamp ?? "";
    lines.push(
      `（platform=${platform}${title ? `，title=${title}` : ""}，更新于 ${updatedAt.slice(0, 19)}）`,
    );
    lines.push("");
    for (const msg of messages) {
      const ts = msg.t.slice(0, 19) || "?";
      lines.push(`${ts} ${roleLabel(msg.role)}: ${msg.content}`);
    }

    blocks.push({
      sessionId,
      title: title ?? "",
      platform,
      updatedAt,
      text: lines.join("\n"),
    });
  }
  return blocks;
}

export function formatDialogueMessage(blocks: LightSleepSessionBlock[]): {
  text: string;
  truncatedSessions: number;
} {
  if (!blocks.length) {
    return { text: "（本日无有效对话）", truncatedSessions: 0 };
  }

  let total = 0;
  const selected: LightSleepSessionBlock[] = [];
  for (const block of blocks) {
    const next = total + block.text.length + 2;
    if (next > MAX_DIALOGUE_CHARS && selected.length > 0) break;
    selected.push(block);
    total = next;
  }

  const truncatedSessions = blocks.length - selected.length;
  const header = `# 本日对话（${selected.length} 个 session）`;
  let body = selected.map((b) => b.text).join("\n\n");
  if (truncatedSessions > 0) {
    body += `\n\n[已截断 ${truncatedSessions} 个 session，超出上下文预算]`;
  }
  return { text: `${header}\n\n${body}`, truncatedSessions };
}

export function formatExistingMemoriesMessage(rows: SemanticMemoryRow[]): string {
  if (!rows.length) return "（与本次 session 无交集的已有 active 记忆）";
  const lines = [`# 已有相关记忆（${rows.length} 条，按 source_sessions 预筛选）`];
  for (const row of rows) {
    const sources = row.source_sessions.length > 0 ? `[${row.source_sessions.join(", ")}]` : "[]";
    const observed = row.observed_at?.slice(0, 19) ?? "?";
    lines.push(
      `[${row.id}] (${row.type}) sources=${sources} observed=${observed}${row.pinned ? " 📌" : ""}`,
    );
    lines.push(row.content);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export const LIGHT_SLEEP_INSTRUCTION_MESSAGE = `# 提取指令

你是运行在逸灵风中的数字生命。请从上方的「本日对话」中提取值得长期记住的事实（第一人称），并对照「已有相关记忆」决定创建、更新或废弃。

## 记忆类型
- world / experience / opinion / observation / preference / procedural / imprint

## 去重规则（局部）
- **仅**与已有记忆中 source_sessions 有交集的条目比较
- 已有更准确 → 跳过或 update
- 新事实补充已有 → update
- 已有不再适用 → memory_semantic_deprecate
- 全新 → memory_semantic_create

## 工具说明

### memory_semantic_create
显式创建。必填 content；建议填写 type、source_sessions（来自对话 session）、observed_at。

### memory_semantic_update（覆盖式）
**仅修改传入的字段，未传字段保持不变。**
- 要改 content/type/pinned/observed_at/occurred_at/status → 传入对应字段
- 要**清空** source_sessions → 显式传 \`source_sessions: []\`
- 未传 source_sessions → 保持原值不变

### memory_semantic_deprecate
软废弃（status=deprecated），保留历史。

请直接调用工具完成写入；无需输出 JSON 摘要。`;

export const LIMBIC_PHASE_INSTRUCTION = `# 情感提取（Phase 2）

基于上方 Phase 1 语义记忆产出与本日 session，判断是否有值得记录的情感体验。

## 克制原则
- 轻微情绪波动、intensity < 0.3 → **不要调用** memory_limbic_create
- 无明确情感信号 → 直接回复「本轮跳过：无值得记录的情感」
- 不重复记录同一 session 的相似情绪

## 工具：memory_limbic_create
- kind：session_mood（整体情绪）| turning_point（情感转折）| spike（强烈瞬间）
- content：第一人称「我感到…」
- valence：-1.0（负）到 1.0（正）；arousal：0.0 到 1.0
- intensity：0.3 以上才写入；关联 semantic_memory_ids 与 session_id

请直接调用工具；无需输出 JSON 摘要。`;

export async function buildLightSleepUserMessages(
  sessionStore: SessionStorePort,
  sessionIds: string[],
): Promise<string[]> {
  const blocks = await collectSessionBlocks(sessionStore, sessionIds);
  const dialogue = formatDialogueMessage(blocks);
  const related = await getSemanticMemoryStore().listBySourceSessions(sessionIds, {
    status: "active",
  });
  return [dialogue.text, formatExistingMemoriesMessage(related), LIGHT_SLEEP_INSTRUCTION_MESSAGE];
}

export function buildLimbicPhaseUserMessages(
  sessionIds: string[],
  semanticMemoryIds: string[],
): string[] {
  const contextLines = [
    "# 本日 session",
    ...sessionIds.map((id) => `- ${id}`),
    "",
    "# Phase 1 语义记忆产出（新建/更新）",
  ];
  if (semanticMemoryIds.length) {
    contextLines.push(...semanticMemoryIds.map((id) => `- ${id}`));
  } else {
    contextLines.push("（本轮仅有废弃或无 id 返回；若无情感信号可跳过）");
  }
  return [contextLines.join("\n"), LIMBIC_PHASE_INSTRUCTION];
}
