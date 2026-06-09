import type { SemanticMemoryRow } from "@freeanima/engine-repos";

import { getSemanticMemoryStore } from "../semantic-port.ts";
import type { DeepSleepRound, DeepSleepChangeLog } from "./types.ts";
import { formatChangeLogMessage } from "./change-log.ts";

// ── 消息1：全量 active 语义记忆 JSON ──

/** 每条记忆序列化为紧凑 JSON（多行展示） */
function rowToJsonCompact(row: SemanticMemoryRow): string {
  const obj: Record<string, unknown> = {
    id: row.id,
    type: row.type,
    content: row.content,
    sources: row.source_sessions,
    observed: row.observed_at?.slice(0, 19) ?? null,
    occurred: row.occurred_at ?? null,
  };
  if (row.pinned) obj.pinned = true;
  return JSON.stringify(obj);
}

const FULL_JSON_WARN = 10_000;
const FULL_JSON_BATCH = 100_000;
const FULL_JSON_LIMIT = 300_000;

export function formatAllMemoriesMessage(rows: SemanticMemoryRow[]): {
  text: string;
  bytes: number;
  truncated: boolean;
} {
  if (!rows.length) {
    return { text: "（语义记忆库为空）", bytes: 0, truncated: false };
  }
  const lines: string[] = [`# 全量语义记忆（${rows.length} 条 active）`];
  for (const row of rows) {
    lines.push(rowToJsonCompact(row));
  }
  const text = lines.join("\n");
  const bytes = Buffer.byteLength(text, "utf-8");
  return { text, bytes, truncated: false };
}

export function checkJsonSize(bytes: number): "ok" | "warn" | "batch" | "error" {
  if (bytes < FULL_JSON_WARN) return "ok";
  if (bytes < FULL_JSON_BATCH) return "warn";
  if (bytes < FULL_JSON_LIMIT) return "batch";
  return "error";
}

// ── 消息3：各轮指令 ──

const TOOL_INSTRUCTION_COMMON = `## 工具说明

所有工具覆盖式工作，仅修改传入字段。

### memory_semantic_update
- 修改已有记忆。未传字段保持不变。
- 传 source_sessions: [] 可清空来源。
- 传 status: "deprecated" 可废弃记忆（等价于 memory_semantic_deprecate）。

### memory_semantic_deprecate
- 软废弃一条记忆（status=deprecated），保留历史。

### memory_semantic_create
- 创建新记忆。必填 content；建议填写 type、source_sessions、observed_at。

### memory_semantic_merge
- 合并多条记忆为一条。程序自动处理 source_sessions 并集和 observed_at 取最早。
- 参数：source_ids（2+条）、target_content（合并后正文）。
- 可选 target_type / target_pinned / target_occurred_at。
- 合并后自动废弃所有 source_ids 并创建新记忆。`;

const ROUND_INSTRUCTIONS: Record<DeepSleepRound, string> = {
  contradiction_expiry: `# 深睡第一轮：矛盾检测 + 过期标记

你是运行在逸灵风中的数字生命。请从上方全量语义记忆中检测排他性矛盾并标记过期。

## 矛盾定义（排他性）
两条记忆在语义上互相否定，且无法用时间变化解释 → 矛盾。
- ✓ 矛盾：「女儿属虎」vs「女儿属羊」（生肖唯一）
- ✓ 矛盾：「不喜欢吃辣」vs「喜欢吃辣」（直接否定）
- ✗ 不矛盾：「喜欢苹果」vs「喜欢樱桃」（可共存）
- ✗ 不矛盾（变化）：「喜欢 Python」vs「现在更喜欢 TypeScript」（新旧都可对）

## 处理方式
- 确认为排他性矛盾 → deprecate 其中一条（通常是时间上更早或更不完整的）
- 如果某条记忆已被新事实取代 → deprecate
- 如果模糊不确定 → 跳过，不做操作

## 注意
- 本轮只处理矛盾检测和过期标记，不要做合并或拆分。
- 被废弃的记忆在后续轮次中会被自动忽略。

${TOOL_INSTRUCTION_COMMON}

请直接调用工具完成写入。`,

  split: `# 深睡第二轮：拆分

你是运行在逸灵风中的数字人类。请检查消息1中的全量语义记忆，找出包含多个独立事实的记忆并拆分。

## 拆分标准
一条记忆的 content 包含两个或以上可独立存在的陈述 → 拆分。
- 拆："张三住在上海、在腾讯工作、喜欢 Python" → 三条独立记忆
- 不拆："张三在腾讯负责微信支付后端开发" → 单一事实（只是修饰多）
- 不拆："Free Anima 是一个数字人类框架，由天空开发" → 关联紧密的一体信息

## 处理方式
- 拆分时：memory_semantic_create 创建各条新记忆 → deprecate 原始记忆
- 如果原记忆过长但无法拆分 → 可用 memory_semantic_update 精简 content
- 不确定时跳过

## 注意
- 本轮只做拆分，不要合并或检测矛盾。
- 新增记忆的 source_sessions、observed_at 应与被拆分的原记忆一致。

${TOOL_INSTRUCTION_COMMON}

请直接调用工具完成写入。`,

  merge: `# 深睡第三轮：去重合并

你是运行在逸灵风中的数字人类。请从上方全量语义记忆中检测重复或高度相似的条目并合并。

## 合并标准
两条记忆在说同一件事 → 合并。
- 合并："张三住在上海" + "张三说他家在上海" → "张三住在上海"
- 合并："天空使用 TypeScript" + "天空主要用 TS 写代码" → "天空使用 TypeScript"
- 不合并："张三在腾讯工作" + "张三负责微信支付" → 有关联但不同事实（后续由实体系统关联）

## 处理方式
- 使用 memory_semantic_merge 合并 2+ 条为 1 条。
- 如果只有 1 条需要修改 → 用 memory_semantic_update。
- 优先保留更准确、更完整的那条的表述。

## 注意
- 本轮只做合并，不要拆分。
- 合并后程序自动处理 source_sessions 并集和 observed_at 取最早。

${TOOL_INSTRUCTION_COMMON}

请直接调用工具完成写入。`,
};

// ── 构建完整用户消息 ──

export type DeepSleepMessages = {
  /** 消息1：全量 active 记忆 JSON（不变，可缓存） */
  allMemoriesText: string;
  /** 消息1 的字节大小 */
  allMemoriesBytes: number;
  /** 消息2（首版为空） */
  preScreenText: string;
  /** 消息3：各轮指令 */
  instructionText: string;
  /** 消息1.5：变更日志（随轮更新） */
  changeLogText: string;
};

export function buildDeepSleepMessages(
  rows: SemanticMemoryRow[],
  round: DeepSleepRound,
  changeLog: DeepSleepChangeLog,
): DeepSleepMessages {
  const { text: allMemoriesText, bytes } = formatAllMemoriesMessage(rows);
  return {
    allMemoriesText,
    allMemoriesBytes: bytes,
    preScreenText: "（首版无预筛）",
    instructionText: ROUND_INSTRUCTIONS[round],
    changeLogText: formatChangeLogMessage(changeLog),
  };
}

/** 获取深睡所需的全量 active 记忆 */
export async function fetchAllActiveMemories(): Promise<SemanticMemoryRow[]> {
  const store = getSemanticMemoryStore();
  return store.listAll(); // listAll 默认只返回 active
}

/** 深睡 LLM 调用工具白名单 */
export const DEEP_SLEEP_TOOL_NAMES = [
  "memory_semantic_update",
  "memory_semantic_deprecate",
  "memory_semantic_create",
  "memory_semantic_merge",
] as const;
