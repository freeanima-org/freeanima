import { getCompressionConfig, getEffectiveTokenBudget } from "./compression-config.ts";
import { isInToolLoop } from "./compression-tool-loop.ts";
import { estimateMessagesTokens, estimateTokens, estimateToolsTokens } from "./token-estimate.ts";
import type { OpenAiToolSchema, SessionMessage } from "@freeanima/legacy-kernel";
import { type CompressionState, parseCompressionState } from "@freeanima/legacy-kernel";

export type { CompressionState };
export { parseCompressionState };

export const SUMMARY_USER_PREFIX = "[会话摘要]";
/** 运行时合成摘要 user 的 pos（≠ l4） */
export const SUMMARY_SYNTHETIC_POS = 1;

export function isCompressed(state: CompressionState | null | undefined): boolean {
  if (!state) return false;
  return state.l2 > 0 || state.l3 > 0;
}

function messagePos(msg: SessionMessage): number {
  if (msg.role === "session_meta") return 0;
  return msg.pos ?? 0;
}

export function getL4(messages: SessionMessage[]): number {
  let max = 0;
  for (const m of messages) {
    if (m.role === "system" || m.role === "session_meta") continue;
    const pos = messagePos(m);
    if (pos > max) max = pos;
  }
  return max;
}

function restMessages(messages: SessionMessage[]): SessionMessage[] {
  return messages.filter((m) => m.role !== "system" && m.role !== "session_meta");
}

export function findLastUserIndex(rest: SessionMessage[]): number {
  for (let i = rest.length - 1; i >= 0; i--) {
    if (rest[i]?.role === "user") return i;
  }
  return -1;
}

/** 精简段单条；tool 丢弃，返回 null */
export function slimMessage(msg: SessionMessage): SessionMessage | null {
  const role = msg.role;
  if (role === "tool") return null;
  if (role === "user") {
    const out: Extract<SessionMessage, { role: "user" }> = { role: "user", content: msg.content };
    if (msg.pos !== undefined) out.pos = msg.pos;
    if (msg.timestamp !== undefined) out.timestamp = msg.timestamp;
    if (msg.name !== undefined) out.name = msg.name;
    return out;
  }
  if (role === "assistant") {
    const calls = msg.tool_calls;
    const hasCalls = Array.isArray(calls) && calls.length > 0;
    const content = String(msg.content ?? "").trim();
    const reasoning = String(msg.reasoning ?? "").trim();
    const text = content || (hasCalls ? reasoning : content || reasoning);
    const out: Extract<SessionMessage, { role: "assistant" }> = {
      role: "assistant",
      content: text || null,
    };
    if (msg.pos !== undefined) out.pos = msg.pos;
    if (msg.name !== undefined) out.name = msg.name;
    return out;
  }
  return { ...msg };
}

function rawSegment(rest: SessionMessage[], l3: number, l4: number): SessionMessage[] {
  return rest.filter((m) => {
    const pos = messagePos(m);
    return pos > l3 && pos <= l4;
  });
}

function slimSegment(rest: SessionMessage[], l2: number, l3: number): SessionMessage[] {
  const seg = rest.filter((m) => {
    const pos = messagePos(m);
    return pos > l2 && pos <= l3;
  });
  const out: SessionMessage[] = [];
  for (const m of seg) {
    const s = slimMessage(m);
    if (s) out.push(s);
  }
  return out;
}

function rawSegmentValid(seg: SessionMessage[], rawMinMessages: number): boolean {
  if (seg.length < rawMinMessages) return false;
  if (!seg.some((m) => m.role === "user")) return false;
  let minPos = Infinity;
  for (const m of seg) {
    const pos = messagePos(m);
    if (pos < minPos) minPos = pos;
  }
  if (!Number.isFinite(minPos)) return false;
  const first = seg.find((m) => messagePos(m) === minPos);
  return first?.role === "user";
}

export type DeriveBoundariesConfig = {
  rawMinMessages: number;
  slimMinMessages: number;
};

export type DeriveBoundariesResult = { l2: number; l3: number };

/**
 * 自右向左推导 l3、l2（与 tool loop 无关）。
 * 无合法边界时返回 null。
 */
export function deriveBoundariesFromL4(
  messages: SessionMessage[],
  l4: number,
  prev: CompressionState | null,
  cfg: DeriveBoundariesConfig,
): DeriveBoundariesResult | null {
  const rest = restMessages(messages);
  if (l4 <= 0) return null;

  const oldL2 = prev?.l2 ?? 0;
  const oldL3 = prev?.l3 ?? 0;

  const posSet = new Set<number>([0]);
  for (const m of rest) {
    const pos = messagePos(m);
    if (!Number.isNaN(pos) && pos < l4) posSet.add(pos);
  }
  const l3Candidates = [...posSet].filter((x) => x < l4).toSorted((a, b) => b - a);

  let bestL3: number | null = null;
  for (const l3 of l3Candidates) {
    const raw = rawSegment(rest, l3, l4);
    if (rawSegmentValid(raw, cfg.rawMinMessages)) {
      bestL3 = l3;
      break;
    }
  }
  if (bestL3 == null) return null;

  const l2Candidates = [...posSet].filter((x) => x < bestL3).toSorted((a, b) => b - a);
  let bestL2: number | null = null;
  for (const l2 of l2Candidates) {
    const slim = slimSegment(rest, l2, bestL3);
    if (slim.length >= cfg.slimMinMessages) {
      bestL2 = l2;
      break;
    }
  }
  if (bestL2 == null) return null;
  if (bestL2 >= bestL3) return null;
  if (bestL3 < oldL3) return null;
  if (bestL2 <= oldL2) return null;

  return { l2: bestL2, l3: bestL3 };
}

export function shouldAdvance(opts: {
  usageRatio: number | null;
  inToolLoop: boolean;
  hasCompressed: boolean;
  triggerLow: number;
  triggerHigh: number;
  emergencyRatio: number;
  forceEmergency?: boolean;
  force?: boolean;
  /** 消息条数模式：无 usageRatio 时用 */
  messageAdvance?: boolean;
}): { advance: boolean; emergency: boolean } {
  if (opts.force) return { advance: true, emergency: false };

  if (opts.usageRatio != null) {
    const ratio = opts.usageRatio;
    if (opts.forceEmergency && ratio >= opts.emergencyRatio) {
      return { advance: true, emergency: true };
    }
    if (opts.inToolLoop) {
      if (ratio >= opts.emergencyRatio) return { advance: true, emergency: true };
      if (ratio >= opts.triggerHigh) return { advance: true, emergency: false };
      return { advance: false, emergency: false };
    }
    if (!opts.hasCompressed && ratio >= opts.triggerLow) {
      return { advance: true, emergency: false };
    }
    if (opts.hasCompressed && ratio >= opts.triggerLow) {
      return { advance: true, emergency: false };
    }
    return { advance: false, emergency: false };
  }

  if (opts.messageAdvance) return { advance: true, emergency: false };
  return { advance: false, emergency: false };
}

/** 四段运行时视图（不含 JSONL 内 system；摘要为合成 pos=1） */
export function buildRuntimeFromLPoints(
  messages: SessionMessage[],
  state: CompressionState | null,
): SessionMessage[] {
  const rest = restMessages(messages);
  const l4 = getL4(messages);
  const l2 = state?.l2 ?? 0;
  const l3 = state?.l3 ?? 0;

  if (!isCompressed(state)) {
    return [...rest];
  }

  const out: SessionMessage[] = [];
  if (state?.summary?.trim()) {
    out.push({
      role: "user",
      content: `${SUMMARY_USER_PREFIX}\n${state.summary.trim()}`,
      pos: SUMMARY_SYNTHETIC_POS,
    });
  }
  out.push(...slimSegment(rest, l2, l3));
  out.push(...rawSegment(rest, l3, l4));
  return out;
}

function buildRuntimeEstimate(
  runtimeBody: SessionMessage[],
  systemPrompt: string,
  tools: OpenAiToolSchema[] | undefined,
): number {
  let total = estimateTokens(systemPrompt);
  total += estimateMessagesTokens(runtimeBody);
  total += estimateToolsTokens(tools);
  return total;
}

export type CompressionAnalysis = {
  enabled: boolean;
  mode: "token" | "messages";
  max_rounds: number;
  threshold: number;
  recompress_at: number;
  l2: number | null;
  l3: number | null;
  l4: number;
  jsonl_total: number;
  window_raw: number;
  window_slim: number;
  hidden_by_compression: number;
  runtime_message_count: number;
  messages_until_recompress: number | null;
  rounds_until_recompress: number | null;
  context_tokens_est: number;
  effective_budget: number | null;
  usage_ratio: number | null;
  has_summary: boolean;
};

export type CompressOptions = {
  maxRounds?: number;
  state?: CompressionState | null;
  systemPrompt?: string;
  tools?: OpenAiToolSchema[];
  model?: string;
  forceEmergency?: boolean;
  force?: boolean;
  effectiveBudgetOverride?: number;
  /** 测试或调参：覆盖 derive 下限 */
  boundaryOverrides?: Partial<DeriveBoundariesConfig>;
};

function messageThreshold(maxRounds: number): { threshold: number; recompressAt: number } {
  const threshold = maxRounds * 2;
  return { threshold, recompressAt: threshold * 2 };
}

export function analyzeCompression(
  messages: SessionMessage[],
  opts?: CompressOptions,
): CompressionAnalysis {
  const cfg = getCompressionConfig();
  const maxRounds = opts?.maxRounds ?? cfg.maxRounds;
  const model = opts?.model ?? "";
  const { threshold, recompressAt } = messageThreshold(maxRounds);
  const budget = opts?.effectiveBudgetOverride ?? (model ? getEffectiveTokenBudget(model) : null);
  const tokenMode = budget != null;
  const state = opts?.state ?? null;
  const rest = restMessages(messages);
  const jsonlTotal = rest.length;
  const l4 = getL4(messages);
  const l2 = state?.l2 ?? null;
  const l3 = state?.l3 ?? null;

  const [compressed] = compress(messages, opts);
  const runtimeBody = compressed.filter((m) => m.role !== "system");
  const runtimeMessageCount = runtimeBody.length;
  const systemPrompt = opts?.systemPrompt ?? "";
  const tokensEst = buildRuntimeEstimate(runtimeBody, systemPrompt, opts?.tools);

  let windowRaw = jsonlTotal;
  let windowSlim = 0;
  if (isCompressed(state) && l3 != null) {
    windowRaw = rawSegment(rest, l3, l4).length;
    windowSlim = slimSegment(rest, state!.l2, l3).length;
  }

  let messagesUntil: number | null = null;
  let roundsUntil: number | null = null;
  if (!tokenMode && jsonlTotal > threshold && isCompressed(state) && windowRaw <= recompressAt) {
    messagesUntil = recompressAt - windowRaw + 1;
    roundsUntil = Math.max(1, Math.ceil(messagesUntil / 2));
  }

  const usageRatio = budget != null && budget > 0 ? tokensEst / budget : null;

  return {
    enabled: true,
    mode: tokenMode ? "token" : "messages",
    max_rounds: maxRounds,
    threshold,
    recompress_at: recompressAt,
    l2,
    l3,
    l4,
    jsonl_total: jsonlTotal,
    window_raw: windowRaw,
    window_slim: windowSlim,
    hidden_by_compression: Math.max(0, jsonlTotal - runtimeMessageCount),
    runtime_message_count: runtimeMessageCount,
    messages_until_recompress: messagesUntil,
    rounds_until_recompress: roundsUntil,
    context_tokens_est: tokensEst,
    effective_budget: budget,
    usage_ratio: usageRatio,
    has_summary: Boolean(state?.summary),
  };
}

/**
 * 有状态压缩：JSONL 不修改；运行时四段视图 + meta l2/l3。
 */
export function compress(
  messages: SessionMessage[],
  opts?: CompressOptions,
): [SessionMessage[], CompressionState | null] {
  const cfg = getCompressionConfig();
  const maxRounds = opts?.maxRounds ?? cfg.maxRounds;
  const state = opts?.state ?? null;
  const model = opts?.model ?? "";
  const { threshold, recompressAt } = messageThreshold(maxRounds);
  const budget = opts?.effectiveBudgetOverride ?? (model ? getEffectiveTokenBudget(model) : null);
  const tokenMode = budget != null;

  const system = messages.filter((m) => m.role === "system");
  const rest = restMessages(messages);
  const l4 = getL4(messages);
  const systemPrompt = opts?.systemPrompt ?? "";
  const compressed = isCompressed(state);

  const runtimeBody = buildRuntimeFromLPoints(messages, state);
  const tokensEst = buildRuntimeEstimate(runtimeBody, systemPrompt, opts?.tools);
  const usageRatio = budget != null && budget > 0 ? tokensEst / budget : null;

  const inToolLoop = isInToolLoop(messages);
  const rawLen = compressed && state ? rawSegment(rest, state.l3, l4).length : rest.length;

  let messageAdvance = false;
  if (!tokenMode) {
    if (!compressed && rest.length > threshold) messageAdvance = true;
    else if (compressed && rawLen > recompressAt) messageAdvance = true;
  }

  const { advance } = shouldAdvance({
    usageRatio,
    inToolLoop: opts?.force ? false : inToolLoop,
    hasCompressed: compressed,
    triggerLow: cfg.triggerLow,
    triggerHigh: cfg.triggerHigh,
    emergencyRatio: cfg.emergencyRatio,
    forceEmergency: opts?.forceEmergency,
    force: opts?.force,
    messageAdvance: opts?.force ? true : messageAdvance,
  });

  if (!advance) {
    const view = buildRuntimeFromLPoints(messages, state);
    return [[...system, ...view], compressed ? state : null];
  }

  const deriveCfg = {
    rawMinMessages: opts?.boundaryOverrides?.rawMinMessages ?? cfg.rawMinMessages,
    slimMinMessages: opts?.boundaryOverrides?.slimMinMessages ?? cfg.slimMinMessages,
  };
  const derived = deriveBoundariesFromL4(messages, l4, state, deriveCfg);

  if (!derived) {
    const view = buildRuntimeFromLPoints(messages, state);
    return [[...system, ...view], compressed ? state : null];
  }

  const newState: CompressionState = {
    l2: derived.l2,
    l3: derived.l3,
    summary: state?.summary,
    summary_at: state?.summary_at,
  };
  const view = buildRuntimeFromLPoints(messages, newState);
  return [[...system, ...view], newState];
}

/** 摘要增量区间 (旧 l2, 新 l2] */
export function sliceForSummary(
  messages: SessionMessage[],
  prevL2: number | null,
  newL2: number,
): SessionMessage[] {
  const rest = restMessages(messages);
  const lo = prevL2 ?? 0;
  return rest.filter((m) => {
    const pos = messagePos(m);
    return !Number.isNaN(pos) && pos > lo && pos <= newL2;
  });
}

export function formatMessagesForSummary(msgs: SessionMessage[]): string {
  const lines: string[] = [];
  for (const m of msgs) {
    switch (m.role) {
      case "tool": {
        const name = m.name ?? "tool";
        lines.push(`[tool:${name}] ${m.content.slice(0, 2000)}`);
        break;
      }
      case "assistant": {
        if (m.tool_calls?.length) {
          lines.push(`[assistant tool_calls] ${JSON.stringify(m.tool_calls).slice(0, 1500)}`);
          break;
        }
        const content = String(m.content ?? "").slice(0, 4000);
        if (content) lines.push(`[assistant] ${content}`);
        break;
      }
      case "user": {
        const content = m.content.slice(0, 4000);
        if (content) lines.push(`[user] ${content}`);
        break;
      }
      default:
        break;
    }
  }
  return lines.join("\n\n");
}
