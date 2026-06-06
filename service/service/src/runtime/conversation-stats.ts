import { getServiceContext } from "../context.ts";
import { isSessionMeta } from "@freeanima/engine-db/domain";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import {
  analyzeCompression,
  buildCompressOptions,
  getCompressionConfig,
  getContextWindow,
  isCompressed,
  parseCompressionState,
} from "@freeanima/engine-compress";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import {
  computeRuntimeContextBreakdown,
  formatTokenK,
  type RuntimeContextBreakdown,
} from "./runtime-context-stats.ts";
import { estimateTokens, messageTextForEstimate } from "@freeanima/engine-compress";
import { normalizeUsage } from "@freeanima/engine-llm";

export type SessionStats = {
  session: string;
  message_count: number;
  assistant_turns: number;
  usage_turns: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_tokens: number | null;
  avg_tps: number | null;
  duration_seconds: number | null;
  throughput_tpm: number | null;
  partial_usage: boolean;
  partial_cached: boolean;
  estimated_usage: boolean;
  compression_enabled: boolean;
  compression_mode: "token" | "messages";
  compression_l2: number | null;
  compression_l3: number | null;
  compression_total_messages: number;
  compression_visible_messages: number;
  compression_hidden: number;
  compression_has_summary: boolean;
  /** token 模式 */
  compression_context_window: number | null;
  compression_effective_budget: number | null;
  compression_usage_ratio: number | null;
  compression_trigger_high: number;
  compression_trigger_low: number;
  /** 消息条数回退模式 */
  compression_max_rounds: number;
  compression_threshold: number;
  compression_recompress_at: number;
  compression_messages_until_recompress: number | null;
  compression_rounds_until_recompress: number | null;
  /** 运行时视图（压缩后）分项 */
  context_breakdown: RuntimeContextBreakdown;
  context_tokens_est: number;
};

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const t = Date.parse(value.replace("Z", "+00:00"));
  return Number.isNaN(t) ? null : new Date(t);
}

function usageFromMessage(msg: SessionMessage): Record<string, number> | null {
  if (msg.role !== "assistant") return null;
  const usage = msg.usage;
  if (usage && typeof usage === "object") {
    return normalizeUsage(usage as Record<string, unknown>);
  }
  return null;
}

export {
  estimateMessagesTokens,
  estimateTokens,
  messageTextForEstimate,
} from "@freeanima/engine-compress";

function emptyBreakdown(): RuntimeContextBreakdown {
  return {
    system_soul: 0,
    system_agents: 0,
    system_resident: 0,
    system_skills: 0,
    summary: 0,
    messages: 0,
    tools: 0,
    total: 0,
  };
}

async function readCompressionAndContextFields(
  session: string,
): Promise<
  Pick<
    SessionStats,
    | "compression_enabled"
    | "compression_mode"
    | "compression_l2"
    | "compression_l3"
    | "compression_total_messages"
    | "compression_visible_messages"
    | "compression_hidden"
    | "compression_has_summary"
    | "compression_context_window"
    | "compression_effective_budget"
    | "compression_usage_ratio"
    | "compression_trigger_high"
    | "compression_trigger_low"
    | "compression_max_rounds"
    | "compression_threshold"
    | "compression_recompress_at"
    | "compression_messages_until_recompress"
    | "compression_rounds_until_recompress"
    | "context_breakdown"
    | "context_tokens_est"
  >
> {
  const cfg = getCompressionConfig();
  const allMsgs = await getServiceContext().conversation.load(session);
  const meta = await getServiceContext().conversation.loadSessionMeta(session);
  const state = parseCompressionState(isSessionMeta(meta) ? meta.compression : undefined);
  const l2 = state?.l2 ?? null;
  const l3 = isCompressed(state) ? (state?.l3 ?? null) : null;
  const fallbackModel = getProfileHopModel(loadConfig(), PROFILE_CHAT);
  const compressOpts = buildCompressOptions(meta, state, fallbackModel);
  const analysis = analyzeCompression(allMsgs, compressOpts);

  let breakdown = emptyBreakdown();
  if (allMsgs.length > 0) {
    try {
      breakdown = await computeRuntimeContextBreakdown(session);
    } catch {
      breakdown = emptyBreakdown();
    }
  }

  return {
    compression_enabled: cfg.enabled,
    compression_mode: analysis.mode,
    compression_l2: l2,
    compression_l3: l3,
    compression_total_messages: analysis.jsonl_total,
    compression_visible_messages: analysis.runtime_message_count,
    compression_hidden: analysis.hidden_by_compression,
    compression_has_summary: analysis.has_summary,
    compression_context_window: compressOpts.model ? getContextWindow(compressOpts.model) : null,
    compression_effective_budget: analysis.effective_budget,
    compression_usage_ratio: analysis.usage_ratio,
    compression_trigger_high: cfg.triggerHigh,
    compression_trigger_low: cfg.triggerLow,
    compression_max_rounds: cfg.maxRounds,
    compression_threshold: analysis.threshold,
    compression_recompress_at: analysis.recompress_at,
    compression_messages_until_recompress:
      analysis.mode === "messages" ? analysis.messages_until_recompress : null,
    compression_rounds_until_recompress:
      analysis.mode === "messages" ? analysis.rounds_until_recompress : null,
    context_breakdown: breakdown,
    context_tokens_est: breakdown.total,
  };
}

function estimateUsageFromMessages(assistantMsgs: Record<string, unknown>[]): {
  input_tokens: number;
  output_tokens: number;
} {
  let output = 0;
  for (const msg of assistantMsgs) {
    output += estimateTokens(messageTextForEstimate(msg));
  }
  const input = Math.round(output * 2.5);
  return { input_tokens: input, output_tokens: output };
}

export async function computeStats(session: string): Promise<SessionStats> {
  const records = await getServiceContext().conversation.load(session);
  const messages = records.filter((r) => r.role !== "session_meta");

  const message_count = messages.length;
  const assistant_msgs = messages.filter((m) => m.role === "assistant");
  const assistant_turns = assistant_msgs.length;

  let input_tokens = 0;
  let output_tokens = 0;
  let cached_tokens = 0;
  let usage_turns = 0;
  let cached_records = 0;
  let latency_total_ms = 0;

  const timestamps: Date[] = [];
  for (const msg of messages) {
    const ts = parseTimestamp(msg.timestamp);
    if (ts) timestamps.push(ts);

    if (msg.role !== "assistant") continue;

    const usage = usageFromMessage(msg);
    if (usage) {
      usage_turns += 1;
      if (usage.prompt_tokens != null) input_tokens += usage.prompt_tokens;
      if (usage.completion_tokens != null) output_tokens += usage.completion_tokens;
      if (usage.cached_tokens != null) {
        cached_tokens += usage.cached_tokens;
        cached_records += 1;
      }
    }

    const latency_ms = msg.latency_ms;
    if (typeof latency_ms === "number" && latency_ms >= 0) {
      latency_total_ms += latency_ms;
    }
  }

  const partial_usage = usage_turns > 0 && usage_turns < assistant_turns;
  const partial_cached = usage_turns > 0 && cached_records > 0 && cached_records < usage_turns;

  let duration_seconds: number | null = null;
  if (timestamps.length >= 2) {
    duration_seconds = Math.max(
      (timestamps[timestamps.length - 1]!.getTime() - timestamps[0]!.getTime()) / 1000,
      0,
    );
  }

  let avg_tps: number | null = null;
  if (output_tokens > 0) {
    if (latency_total_ms > 0) {
      avg_tps = output_tokens / (latency_total_ms / 1000);
    } else if (duration_seconds && duration_seconds > 0) {
      avg_tps = output_tokens / duration_seconds;
    }
  }

  let throughput_tpm: number | null = null;
  if (output_tokens > 0 && duration_seconds && duration_seconds > 0) {
    throughput_tpm = output_tokens / (duration_seconds / 60);
  }

  let estimated_usage = false;
  if (usage_turns === 0 && assistant_turns > 0) {
    const est = estimateUsageFromMessages(assistant_msgs);
    input_tokens = est.input_tokens;
    output_tokens = est.output_tokens;
    estimated_usage = true;
    if (output_tokens > 0) {
      if (latency_total_ms > 0) {
        avg_tps = output_tokens / (latency_total_ms / 1000);
      } else if (duration_seconds && duration_seconds > 0) {
        avg_tps = output_tokens / duration_seconds;
      }
      if (duration_seconds && duration_seconds > 0) {
        throughput_tpm = output_tokens / (duration_seconds / 60);
      }
    }
  }

  return {
    session,
    message_count,
    assistant_turns,
    usage_turns,
    input_tokens: usage_turns || estimated_usage ? input_tokens : null,
    output_tokens: usage_turns || estimated_usage ? output_tokens : null,
    cached_tokens: cached_records ? cached_tokens : null,
    avg_tps,
    duration_seconds,
    throughput_tpm,
    partial_usage,
    partial_cached,
    estimated_usage,
    ...(await readCompressionAndContextFields(session)),
  };
}

export function mergeStats(items: SessionStats[], label = "汇总"): SessionStats {
  if (!items.length) {
    const cfg = getCompressionConfig();
    return {
      session: label,
      message_count: 0,
      assistant_turns: 0,
      usage_turns: 0,
      input_tokens: null,
      output_tokens: null,
      cached_tokens: null,
      avg_tps: null,
      duration_seconds: null,
      throughput_tpm: null,
      partial_usage: false,
      partial_cached: false,
      estimated_usage: false,
      compression_enabled: false,
      compression_mode: "messages",
      compression_l2: null,
      compression_l3: null,
      compression_total_messages: 0,
      compression_visible_messages: 0,
      compression_hidden: 0,
      compression_has_summary: false,
      compression_context_window: null,
      compression_effective_budget: null,
      compression_usage_ratio: null,
      compression_trigger_high: cfg.triggerHigh,
      compression_trigger_low: cfg.triggerLow,
      compression_max_rounds: cfg.maxRounds,
      compression_threshold: cfg.maxRounds * 2,
      compression_recompress_at: cfg.maxRounds * 4,
      compression_messages_until_recompress: null,
      compression_rounds_until_recompress: null,
      context_breakdown: emptyBreakdown(),
      context_tokens_est: 0,
    };
  }

  const message_count = items.reduce((s, i) => s + i.message_count, 0);
  const assistant_turns = items.reduce((s, i) => s + i.assistant_turns, 0);
  const usage_turns = items.reduce((s, i) => s + i.usage_turns, 0);

  const has_usage = items.some((s) => s.input_tokens != null || s.output_tokens != null);
  const input_tokens = has_usage ? items.reduce((s, i) => s + (i.input_tokens ?? 0), 0) : null;
  const output_tokens = has_usage ? items.reduce((s, i) => s + (i.output_tokens ?? 0), 0) : null;

  const has_cached = items.some((s) => s.cached_tokens != null);
  const cached_tokens = has_cached ? items.reduce((s, i) => s + (i.cached_tokens ?? 0), 0) : null;

  const duration_values = items
    .map((s) => s.duration_seconds)
    .filter((d): d is number => d != null);
  const duration_seconds = duration_values.length
    ? duration_values.reduce((a, b) => a + b, 0)
    : null;

  let avg_tps: number | null = null;
  if (output_tokens && output_tokens > 0) {
    let weighted_latency = 0;
    for (const s of items) {
      if (s.output_tokens && s.avg_tps && s.avg_tps > 0) {
        weighted_latency += s.output_tokens / s.avg_tps;
      }
    }
    if (weighted_latency > 0) {
      avg_tps = output_tokens / weighted_latency;
    } else if (duration_seconds && duration_seconds > 0) {
      avg_tps = output_tokens / duration_seconds;
    }
  }

  let throughput_tpm: number | null = null;
  if (output_tokens && duration_seconds && duration_seconds > 0) {
    throughput_tpm = output_tokens / (duration_seconds / 60);
  }

  const bd = emptyBreakdown();
  for (const s of items) {
    bd.system_soul += s.context_breakdown.system_soul;
    bd.system_agents += s.context_breakdown.system_agents;
    bd.system_resident += s.context_breakdown.system_resident;
    bd.system_skills += s.context_breakdown.system_skills;
    bd.summary += s.context_breakdown.summary;
    bd.messages += s.context_breakdown.messages;
    bd.tools += s.context_breakdown.tools;
    bd.total += s.context_breakdown.total;
  }

  return {
    session: label,
    message_count,
    assistant_turns,
    usage_turns,
    input_tokens,
    output_tokens,
    cached_tokens,
    avg_tps,
    duration_seconds,
    throughput_tpm,
    partial_usage: items.some((s) => s.partial_usage),
    partial_cached: items.some((s) => s.partial_cached),
    estimated_usage: items.some((s) => s.estimated_usage),
    compression_enabled: items.some((s) => s.compression_enabled),
    compression_mode: items[0]?.compression_mode ?? "messages",
    compression_l2: null,
    compression_l3: null,
    compression_total_messages: items.reduce((s, i) => s + i.compression_total_messages, 0),
    compression_visible_messages: items.reduce((s, i) => s + i.compression_visible_messages, 0),
    compression_hidden: items.reduce((s, i) => s + i.compression_hidden, 0),
    compression_has_summary: items.some((s) => s.compression_has_summary),
    compression_context_window: items[0]?.compression_context_window ?? null,
    compression_effective_budget: null,
    compression_usage_ratio: null,
    compression_trigger_high: items[0]?.compression_trigger_high ?? 0.72,
    compression_trigger_low: items[0]?.compression_trigger_low ?? 0.55,
    compression_max_rounds: items[0]?.compression_max_rounds ?? 50,
    compression_threshold: items[0]?.compression_threshold ?? 100,
    compression_recompress_at: items[0]?.compression_recompress_at ?? 200,
    compression_messages_until_recompress: null,
    compression_rounds_until_recompress: null,
    context_breakdown: bd,
    context_tokens_est: bd.total,
  };
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "未知";
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m ${secs}s`;
}

function formatNumber(
  value: number | null,
  opts?: { partial?: boolean; estimated?: boolean; digits?: number },
): string {
  if (value == null) {
    if (opts?.partial === false && opts?.estimated === false) return "未知";
    return "未知";
  }
  const digits = opts?.digits ?? 1;
  const text =
    typeof value === "number" && !Number.isInteger(value) ? value.toFixed(digits) : String(value);
  const suffixes: string[] = [];
  if (opts?.estimated) suffixes.push("估算");
  if (opts?.partial) suffixes.push("部分");
  if (!suffixes.length) return text;
  return `${opts?.estimated ? "~" : ""}${text}（${suffixes.join("，")}）`;
}

function formatPct(ratio: number | null): string {
  if (ratio == null) return "—";
  return `${Math.round(ratio * 1000) / 10}%`;
}

function formatCompression(stats: SessionStats): string {
  if (!stats.compression_enabled) return "会话压缩: 已关闭";

  const lines = ["会话压缩: 已启用"];

  if (stats.compression_mode === "token") {
    const win = stats.compression_context_window;
    const budget = stats.compression_effective_budget;
    lines.push(
      `模式: token 占用率（窗口 ${win != null ? formatTokenK(win) : "—"} tokens，有效预算 ${budget != null ? formatTokenK(budget) : "—"}）`,
    );
    lines.push(
      `触发阈: 压缩 ≥${formatPct(stats.compression_trigger_high)}，滞回 <${formatPct(stats.compression_trigger_low)}；当前占用 ${formatPct(stats.compression_usage_ratio)}`,
    );
  } else {
    lines.push(`模式: 消息条数回退（max_rounds=${stats.compression_max_rounds}）`);
    lines.push(
      `触发阈: 首次 >${stats.compression_threshold} 条，再压缩窗口 >${stats.compression_recompress_at} 条`,
    );
  }

  if (stats.compression_l3 == null) {
    lines.push(
      `尚未压缩（JSONL ${stats.compression_total_messages} 条；运行时约 ${formatTokenK(stats.context_tokens_est)} tokens）`,
    );
    return lines.join("\n");
  }

  lines.push(
    `l2=${stats.compression_l2 ?? 0} l3=${stats.compression_l3}；JSONL 存档 ${stats.compression_total_messages} 条`,
  );
  lines.push(
    `运行时可见 ${stats.compression_visible_messages} 条消息（相对全量隐藏 ${stats.compression_hidden} 条）`,
  );
  if (stats.compression_has_summary) {
    lines.push(`会话摘要: 已注入（约 ${formatTokenK(stats.context_breakdown.summary)} tokens）`);
  }

  if (stats.compression_mode === "messages") {
    if (stats.compression_messages_until_recompress != null) {
      lines.push(
        `距再次裁剪: 约 ${stats.compression_messages_until_recompress} 条消息（~${stats.compression_rounds_until_recompress} 轮）`,
      );
    } else if (
      stats.compression_visible_messages > 0 &&
      stats.compression_recompress_at > 0 &&
      stats.compression_total_messages - stats.compression_hidden > stats.compression_recompress_at
    ) {
      lines.push("距再次裁剪: 已达阈，下次 beginTurn 将推进 l2/l3");
    }
  } else if (
    stats.compression_usage_ratio != null &&
    stats.compression_usage_ratio >= stats.compression_trigger_high
  ) {
    lines.push("距再次压缩: 占用已达上限，下次 beginTurn 将推进 l2/l3");
  } else if (
    stats.compression_usage_ratio != null &&
    stats.compression_usage_ratio < stats.compression_trigger_low
  ) {
    lines.push("距再次压缩: 占用低于滞回下限，暂不前移边界");
  }

  return lines.join("\n");
}

function formatContextBreakdown(stats: SessionStats): string[] {
  const b = stats.context_breakdown;
  const systemTotal = b.system_soul + b.system_agents + b.system_resident + b.system_skills;
  const lines = [
    `当前上下文（运行时视图，压缩后）: ~${formatTokenK(stats.context_tokens_est)} tokens`,
    `  系统提示词合计: ~${formatTokenK(systemTotal)}`,
  ];
  if (b.system_soul > 0) lines.push(`    SOUL: ~${formatTokenK(b.system_soul)}`);
  if (b.system_agents > 0) lines.push(`    AGENTS.md: ~${formatTokenK(b.system_agents)}`);
  if (b.system_resident > 0) lines.push(`    常驻记忆: ~${formatTokenK(b.system_resident)}`);
  if (b.system_skills > 0) lines.push(`    技能: ~${formatTokenK(b.system_skills)}`);
  if (b.summary > 0) lines.push(`  会话摘要: ~${formatTokenK(b.summary)}`);
  lines.push(`  会话消息: ~${formatTokenK(b.messages)}`);
  lines.push(`  工具 schema: ~${formatTokenK(b.tools)}`);
  lines.push("（以上为字符粗估 ÷3.5；tools 为 API 请求体中的 schema，不计入 messages 数组）");
  return lines;
}

function formatUsageNote(stats: SessionStats): string | null {
  if (stats.usage_turns > 0) {
    if (stats.partial_usage) {
      return `usage 记录: ${stats.usage_turns}/${stats.assistant_turns} 轮（部分轮次无记录）`;
    }
    return null;
  }
  if (stats.estimated_usage) {
    return `usage 记录: 0/${stats.assistant_turns} 轮（JSONL 无 API usage，以下为内容粗估）`;
  }
  return `usage 记录: 0/${stats.assistant_turns} 轮`;
}

export function formatStats(stats: SessionStats): string {
  const usageOpts = {
    partial: stats.partial_usage,
    estimated: stats.estimated_usage,
  };
  const lines = [
    `Session: ${stats.session}`,
    `消息数: ${stats.message_count}（JSONL 全量，含已裁隐藏）`,
    `assistant 轮次: ${stats.assistant_turns}`,
    formatCompression(stats),
    ...formatContextBreakdown(stats),
    `输入 token: ${formatNumber(stats.input_tokens, usageOpts)}`,
    `输出 token: ${formatNumber(stats.output_tokens, usageOpts)}`,
    `缓存 token: ${formatNumber(stats.cached_tokens, { partial: stats.partial_cached })}`,
    `平均 tps: ${formatNumber(stats.avg_tps, { digits: 1, estimated: stats.estimated_usage })}`,
    `会话时长: ${formatDuration(stats.duration_seconds)}`,
    `吞吐: ${formatNumber(stats.throughput_tpm, { digits: 1, estimated: stats.estimated_usage })} token/min`,
  ];
  const usageNote = formatUsageNote(stats);
  if (usageNote) {
    const tokenIdx = lines.findIndex((l) => l.startsWith("输入 token:"));
    lines.splice(tokenIdx >= 0 ? tokenIdx : lines.length, 0, usageNote);
  }
  return lines.join("\n");
}

export async function statsReport(
  session?: string | null,
  opts?: { allSessions?: boolean },
): Promise<string> {
  if (opts?.allSessions) {
    const sessions = await getServiceContext().conversation.listSessions();
    if (!sessions.length) return "（无 session）";
    const parts: string[] = [];
    const perSession: SessionStats[] = [];
    for (const name of sessions) {
      const item = await computeStats(name);
      perSession.push(item);
      parts.push(formatStats(item));
    }
    parts.push(formatStats(mergeStats(perSession, `汇总 (${sessions.length} 个 session)`)));
    return parts.join("\n\n");
  }

  const name = session;
  if (!name) return statsReport(null, { allSessions: true });
  if (!(await getServiceContext().conversation.sessionExists(name)))
    return `Session: ${name}\n（空）`;
  return formatStats(await computeStats(name));
}
