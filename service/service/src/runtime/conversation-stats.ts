import type { RuntimeDeps } from "./runtime-deps.ts";
import { isSessionMeta } from "@freeanima/core/db/domain";
import type { SessionMessage } from "@freeanima/core/db/domain";
import {
  analyzeCompression,
  buildCompressOptions,
  getCompressionConfig,
  getContextWindow,
  isCompressed,
  parseCompressionState,
} from "@freeanima/core/compress";
import { getProfileHopModel } from "@freeanima/service-config";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import {
  computeRuntimeContextBreakdown,
  formatTokenK,
  type RuntimeContextBreakdown,
} from "./runtime-context-stats.ts";
import { estimateTokens, messageTextForEstimate } from "@freeanima/core/compress";
import { normalizeUsage } from "@freeanima/core/llm";

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
  /** token mode */
  compression_context_window: number | null;
  compression_effective_budget: number | null;
  compression_usage_ratio: number | null;
  compression_trigger_high: number;
  compression_trigger_low: number;
  /** message-count fallback mode */
  compression_max_rounds: number;
  compression_threshold: number;
  compression_recompress_at: number;
  compression_messages_until_recompress: number | null;
  compression_rounds_until_recompress: number | null;
  /** Runtime view (post-compression) breakdown */
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
} from "@freeanima/core/compress";

function emptyBreakdown(): RuntimeContextBreakdown {
  return {
    system_self: 0,
    system_agents: 0,
    system_resident: 0,
    system_toolsets: 0,
    summary: 0,
    messages: 0,
    tools: 0,
    total: 0,
  };
}

async function readCompressionAndContextFields(
  deps: RuntimeDeps,
  session: string,
  preloaded?: SessionMessage[],
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
  const meta = await deps.conversation.loadSessionMeta(session);
  const allMsgs = preloaded ?? (await deps.conversation.loadForRuntime(session));
  const state = parseCompressionState(isSessionMeta(meta) ? meta.compression : undefined);
  const l2 = state?.l2 ?? null;
  const l3 = isCompressed(state) ? (state?.l3 ?? null) : null;
  const fallbackModel = getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);
  const tools = isSessionMeta(meta) ? await deps.conversation.loadSessionTools(session, meta) : [];
  const compressOpts = buildCompressOptions(meta, state, fallbackModel, { tools });
  const analysis = analyzeCompression(allMsgs, compressOpts);
  const storedTotal = await deps.conversation.countMessages(session);

  let breakdown = emptyBreakdown();
  if (allMsgs.length > 0) {
    try {
      breakdown = await computeRuntimeContextBreakdown(deps, session);
    } catch {
      breakdown = emptyBreakdown();
    }
  }

  return {
    compression_enabled: cfg.enabled,
    compression_mode: analysis.mode,
    compression_l2: l2,
    compression_l3: l3,
    compression_total_messages: storedTotal,
    compression_visible_messages: analysis.runtime_message_count,
    compression_hidden: Math.max(0, storedTotal - analysis.runtime_message_count),
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

function estimateUsageFromMessages(
  assistantMsgs: Record<string, unknown>[],
  model: string,
): {
  input_tokens: number;
  output_tokens: number;
} {
  let output = 0;
  for (const msg of assistantMsgs) {
    output += estimateTokens(messageTextForEstimate(msg), model);
  }
  const input = Math.round(output * 2.5);
  return { input_tokens: input, output_tokens: output };
}

export async function computeStats(deps: RuntimeDeps, session: string): Promise<SessionStats> {
  const message_count = await deps.conversation.countMessages(session);
  const records = message_count > 0 ? await deps.conversation.load(session) : [];
  const messages = records.filter((r) => r.role !== "session_meta");
  const assistant_msgs = messages.filter((m) => m.role === "assistant");
  const assistant_turns = assistant_msgs.length;
  const meta = message_count > 0 ? await deps.conversation.loadSessionMeta(session) : null;
  const fallbackModel = getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);
  const model = meta != null && isSessionMeta(meta) ? meta.model : fallbackModel;

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
    const est = estimateUsageFromMessages(assistant_msgs, model);
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
    ...(await readCompressionAndContextFields(deps, session, records)),
  };
}

export function mergeStats(items: SessionStats[], label = "Summary"): SessionStats {
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
    bd.system_self += s.context_breakdown.system_self;
    bd.system_agents += s.context_breakdown.system_agents;
    bd.system_resident += s.context_breakdown.system_resident;
    bd.system_toolsets += s.context_breakdown.system_toolsets;
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
  if (seconds == null) return "unknown";
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
    if (opts?.partial === false && opts?.estimated === false) return "unknown";
    return "unknown";
  }
  const digits = opts?.digits ?? 1;
  const text =
    typeof value === "number" && !Number.isInteger(value) ? value.toFixed(digits) : String(value);
  const suffixes: string[] = [];
  if (opts?.estimated) suffixes.push("estimated");
  if (opts?.partial) suffixes.push("partial");
  if (!suffixes.length) return text;
  return `${opts?.estimated ? "~" : ""}${text} (${suffixes.join(", ")})`;
}

function formatPct(ratio: number | null): string {
  if (ratio == null) return "—";
  return `${Math.round(ratio * 1000) / 10}%`;
}

function formatCompression(stats: SessionStats): string {
  if (!stats.compression_enabled) return "Session compression: disabled";

  const lines = ["Session compression: enabled"];

  if (stats.compression_mode === "token") {
    const win = stats.compression_context_window;
    const budget = stats.compression_effective_budget;
    lines.push(
      `Mode: token utilization (window ${win != null ? formatTokenK(win) : "—"} tokens, effective budget ${budget != null ? formatTokenK(budget) : "—"})`,
    );
    lines.push(
      `Trigger: compress ≥${formatPct(stats.compression_trigger_high)}, hysteresis <${formatPct(stats.compression_trigger_low)}; current usage ${formatPct(stats.compression_usage_ratio)}`,
    );
  } else {
    lines.push(`Mode: message-count fallback (max_rounds=${stats.compression_max_rounds})`);
    lines.push(
      `Trigger: first >${stats.compression_threshold} messages, recompress window >${stats.compression_recompress_at} messages`,
    );
  }

  if (stats.compression_l3 == null) {
    lines.push(
      `Not yet compressed (archive ${stats.compression_total_messages} messages; runtime ~${formatTokenK(stats.context_tokens_est)} tokens)`,
    );
    return lines.join("\n");
  }

  lines.push(
    `l2=${stats.compression_l2 ?? 0} l3=${stats.compression_l3}; archive ${stats.compression_total_messages} messages`,
  );
  lines.push(
    `Runtime visible ${stats.compression_visible_messages} messages (hidden vs full archive ${stats.compression_hidden})`,
  );
  if (stats.compression_has_summary) {
    lines.push(
      `Session summary: injected (~${formatTokenK(stats.context_breakdown.summary)} tokens)`,
    );
  }

  if (stats.compression_mode === "messages") {
    if (stats.compression_messages_until_recompress != null) {
      lines.push(
        `Until next trim: ~${stats.compression_messages_until_recompress} messages (~${stats.compression_rounds_until_recompress} turns)`,
      );
    } else if (
      stats.compression_visible_messages > 0 &&
      stats.compression_recompress_at > 0 &&
      stats.compression_total_messages - stats.compression_hidden > stats.compression_recompress_at
    ) {
      lines.push("Until next trim: threshold reached; next beginTurn will advance l2/l3");
    }
  } else if (
    stats.compression_usage_ratio != null &&
    stats.compression_usage_ratio >= stats.compression_trigger_high
  ) {
    lines.push("Until next compress: usage at cap; next beginTurn will advance l2/l3");
  } else if (
    stats.compression_usage_ratio != null &&
    stats.compression_usage_ratio < stats.compression_trigger_low
  ) {
    lines.push("Until next compress: usage below hysteresis floor; boundary not advanced yet");
  }

  return lines.join("\n");
}

function formatContextBreakdown(stats: SessionStats): string[] {
  const b = stats.context_breakdown;
  const systemTotal = b.system_self + b.system_agents + b.system_resident + b.system_toolsets;
  const lines = [
    `Current context (runtime view, post-compression): ~${formatTokenK(stats.context_tokens_est)} tokens`,
    `  System prompts total: ~${formatTokenK(systemTotal)}`,
  ];
  if (b.system_self > 0) lines.push(`    Self-layer: ~${formatTokenK(b.system_self)}`);
  if (b.system_toolsets > 0) lines.push(`    ToolSets: ~${formatTokenK(b.system_toolsets)}`);
  if (b.system_agents > 0) lines.push(`    AGENTS.md: ~${formatTokenK(b.system_agents)}`);
  if (b.system_resident > 0) lines.push(`    Resident memory: ~${formatTokenK(b.system_resident)}`);
  if (b.summary > 0) lines.push(`  Session summary: ~${formatTokenK(b.summary)}`);
  lines.push(`  Session messages: ~${formatTokenK(b.messages)}`);
  lines.push(`  Tool schema: ~${formatTokenK(b.tools)}`);
  lines.push(
    "(tokenizer estimate via @freeanima/core/tokenizer; tools are schema in API request body, not counted in messages array)",
  );
  return lines;
}

function formatUsageNote(stats: SessionStats): string | null {
  if (stats.usage_turns > 0) {
    if (stats.partial_usage) {
      return `usage records: ${stats.usage_turns}/${stats.assistant_turns} turns (some turns missing records)`;
    }
    return null;
  }
  if (stats.estimated_usage) {
    return `usage records: 0/${stats.assistant_turns} turns (no API usage in archive; estimates below from content)`;
  }
  return `usage records: 0/${stats.assistant_turns} turns`;
}

export function formatStats(stats: SessionStats): string {
  const usageOpts = {
    partial: stats.partial_usage,
    estimated: stats.estimated_usage,
  };
  const lines = [
    `Session: ${stats.session}`,
    `Message count: ${stats.message_count} (full archive, including trimmed/hidden)`,
    `assistant turns: ${stats.assistant_turns}`,
    formatCompression(stats),
    ...formatContextBreakdown(stats),
    `Input tokens: ${formatNumber(stats.input_tokens, usageOpts)}`,
    `Output tokens: ${formatNumber(stats.output_tokens, usageOpts)}`,
    `Cached tokens: ${formatNumber(stats.cached_tokens, { partial: stats.partial_cached })}`,
    `Avg tps: ${formatNumber(stats.avg_tps, { digits: 1, estimated: stats.estimated_usage })}`,
    `Session duration: ${formatDuration(stats.duration_seconds)}`,
    `Throughput: ${formatNumber(stats.throughput_tpm, { digits: 1, estimated: stats.estimated_usage })} token/min`,
  ];
  const usageNote = formatUsageNote(stats);
  if (usageNote) {
    const tokenIdx = lines.findIndex((l) => l.startsWith("Input tokens:"));
    lines.splice(tokenIdx >= 0 ? tokenIdx : lines.length, 0, usageNote);
  }
  return lines.join("\n");
}

export async function statsReport(
  deps: RuntimeDeps,
  session?: string | null,
  opts?: { allSessions?: boolean },
): Promise<string> {
  if (opts?.allSessions) {
    const sessions = await deps.conversation.listSessions();
    if (!sessions.length) return "(no sessions)";
    const parts: string[] = [];
    const perSession: SessionStats[] = [];
    for (const name of sessions) {
      const item = await computeStats(deps, name);
      perSession.push(item);
      parts.push(formatStats(item));
    }
    parts.push(formatStats(mergeStats(perSession, `Summary (${sessions.length} session(s))`)));
    return parts.join("\n\n");
  }

  const name = session;
  if (!name) return statsReport(deps, null, { allSessions: true });
  if (!(await deps.conversation.sessionExists(name))) return `Session: ${name}\n(empty)`;
  return formatStats(await computeStats(deps, name));
}
