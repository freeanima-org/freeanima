import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  getActiveRuntimeConfig,
  resolveContextWindowWithSource,
  type ContextWindowSource,
} from "@freeanima/habitat/core/config";
import { getCompressionConfig, getEffectiveTokenBudget } from "./compression-config.ts";
import { isInToolLoop } from "./compression-tool-loop.ts";
import { estimateMessagesTokens, estimateTokens, estimateToolsTokens } from "./token-estimate.ts";
import type { OpenAiToolSchema, StoredMessage } from "@freeanima/habitat/core/db/domain";
import { type CompressionState, parseCompressionState } from "@freeanima/habitat/core/db/domain";
import { parseMemoryReferenceMarkers } from "@freeanima/habitat/core/db/pg/memory-reference";

export type { CompressionState };
export { parseCompressionState };

export const SUMMARY_USER_PREFIX = "[conversation summary]";
/** Runtime synthetic summary user pos (≠ l4) */
export const SUMMARY_SYNTHETIC_POS = 1;

export function isCompressed(state: CompressionState | null | undefined): boolean {
  if (!state) return false;
  return state.l2 > 0 || state.l3 > 0;
}

function messagePos(msg: StoredMessage): number {
  return msg.pos ?? 0;
}

export function getL4(messages: StoredMessage[]): number {
  let max = 0;
  for (const m of messages) {
    if (m.role === "system") continue;
    const pos = messagePos(m);
    if (pos > max) max = pos;
  }
  return max;
}

function restMessages(messages: StoredMessage[]): StoredMessage[] {
  return messages.filter((m) => m.role !== "system");
}

export function findLastUserIndex(rest: StoredMessage[]): number {
  for (let i = rest.length - 1; i >= 0; i--) {
    if (rest[i]?.role === "user") return i;
  }
  return -1;
}

/** Single slim-segment message; tool dropped, returns null.
 *  Messages containing `[[anima:id]]` keep fuller content (importance heuristic).
 */
export function slimMessage(msg: StoredMessage): StoredMessage | null {
  const role = msg.role;
  if (role === "tool") return null;
  if (role === "user") {
    const out: Extract<StoredMessage, { role: "user" }> = { role: "user", content: msg.content };
    if (msg.pos !== undefined) out.pos = msg.pos;
    if (msg.timestamp !== undefined) out.timestamp = msg.timestamp;
    if (msg.name !== undefined) out.name = msg.name;
    return out;
  }
  if (role === "assistant") {
    const calls = msg.tool_calls;
    const hasCalls = Array.isArray(calls) && calls.length > 0;
    const content = (msg.content ?? "").trim();
    const reasoning = (msg.reasoning ?? "").trim();
    const hasCite =
      parseMemoryReferenceMarkers(content).length > 0 ||
      parseMemoryReferenceMarkers(reasoning).length > 0;
    let text = content || reasoning;
    // 含记忆引用时优先保留正文，避免只剩 tool 占位而丢掉 [[anima:id]]
    if (hasCite && content) {
      text = content;
    } else if (!text && hasCalls) {
      const names = calls
        .map((c) => c.function?.name?.trim())
        .filter((n): n is string => Boolean(n));
      text = names.length > 0 ? `[tools executed: ${names.join(", ")}]` : "[tool call executed]";
    }
    if (!text) return null;
    const out: Extract<StoredMessage, { role: "assistant" }> = {
      role: "assistant",
      content: text,
    };
    if (msg.pos !== undefined) out.pos = msg.pos;
    if (msg.name !== undefined) out.name = msg.name;
    return out;
  }
  return { ...msg };
}

function rawSegment(rest: StoredMessage[], l3: number, l4: number): StoredMessage[] {
  return rest.filter((m) => {
    const pos = messagePos(m);
    return pos > l3 && pos <= l4;
  });
}

function slimSegment(rest: StoredMessage[], l2: number, l3: number): StoredMessage[] {
  const seg = rest.filter((m) => {
    const pos = messagePos(m);
    return pos > l2 && pos <= l3;
  });
  const out: StoredMessage[] = [];
  for (const m of seg) {
    const s = slimMessage(m);
    if (s) out.push(s);
  }
  return out;
}

function rawSegmentValid(seg: StoredMessage[], rawMinMessages: number): boolean {
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
 * Derive l3, l2 right-to-left (independent of tool loop).
 * Returns null when no valid boundary.
 */
export function deriveBoundariesFromL4(
  messages: StoredMessage[],
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
  /** Message-count mode: used when usageRatio is absent */
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

/** Four-segment runtime view (no persisted system; summary synthetic pos=1) */
export function buildRuntimeFromLPoints(
  messages: StoredMessage[],
  state: CompressionState | null,
): StoredMessage[] {
  const rest = restMessages(messages);
  const l4 = getL4(messages);
  const l2 = state?.l2 ?? 0;
  const l3 = state?.l3 ?? 0;

  if (!isCompressed(state)) {
    return [...rest];
  }

  const out: StoredMessage[] = [];
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
  runtimeBody: StoredMessage[],
  systemPrompt: string,
  tools: OpenAiToolSchema[] | undefined,
  model?: string,
): number {
  let total = estimateTokens(systemPrompt, model);
  total += estimateMessagesTokens(runtimeBody, model);
  total += estimateToolsTokens(tools, model);
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
  stored_total: number;
  window_raw: number;
  window_slim: number;
  hidden_by_compression: number;
  runtime_message_count: number;
  messages_until_recompress: number | null;
  rounds_until_recompress: number | null;
  context_tokens_est: number;
  effective_budget: number | null;
  usage_ratio: number | null;
  context_window: number | null;
  context_window_source: ContextWindowSource | null;
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
  catalogContextWindow?: number;
  contextWindow?: number;
  contextWindowSource?: ContextWindowSource | null;
  /** Test or tuning: override derive minimums */
  boundaryOverrides?: Partial<DeriveBoundariesConfig>;
};

function resolveCompressBudget(
  model: string,
  opts?: CompressOptions,
): { budget: number | null; window: number | null; source: ContextWindowSource | null } {
  if (opts?.effectiveBudgetOverride != null) {
    return {
      budget: opts.effectiveBudgetOverride,
      window: opts.contextWindow ?? null,
      source: opts.contextWindowSource ?? null,
    };
  }
  if (!model) {
    return { budget: null, window: null, source: null };
  }
  const catalogFallback = opts?.catalogContextWindow;
  const { window, source } = resolveContextWindowWithSource(
    getActiveRuntimeConfig().data,
    model,
    omitUndefined({
      catalogFallback,
    }),
  );
  if (window == null) {
    return { budget: null, window: null, source: null };
  }
  const budget = getEffectiveTokenBudget(model, undefined, omitUndefined({ catalogFallback }));
  return { budget, window, source };
}

function messageThreshold(maxRounds: number): { threshold: number; recompressAt: number } {
  const threshold = maxRounds * 2;
  return { threshold, recompressAt: threshold * 2 };
}

export function analyzeCompression(
  messages: StoredMessage[],
  opts?: CompressOptions,
): CompressionAnalysis {
  const cfg = getCompressionConfig();
  const maxRounds = opts?.maxRounds ?? cfg.maxRounds;
  const model = opts?.model ?? "";
  const { threshold, recompressAt } = messageThreshold(maxRounds);
  const { budget, window, source } = resolveCompressBudget(model, opts);
  const tokenMode = budget != null;
  const state = opts?.state ?? null;
  const rest = restMessages(messages);
  const storedTotal = rest.length;
  const l4 = getL4(messages);
  const l2 = state?.l2 ?? null;
  const l3 = state?.l3 ?? null;

  const [compressed] = compress(messages, opts);
  const runtimeBody = compressed.filter((m) => m.role !== "system");
  const runtimeMessageCount = runtimeBody.length;
  const systemPrompt = opts?.systemPrompt ?? "";
  const tokensEst = buildRuntimeEstimate(runtimeBody, systemPrompt, opts?.tools, model);

  let windowRaw = storedTotal;
  let windowSlim = 0;
  if (isCompressed(state) && state !== null && l3 != null) {
    windowRaw = rawSegment(rest, l3, l4).length;
    windowSlim = slimSegment(rest, state.l2, l3).length;
  }

  let messagesUntil: number | null = null;
  let roundsUntil: number | null = null;
  if (!tokenMode && storedTotal > threshold && isCompressed(state) && windowRaw <= recompressAt) {
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
    stored_total: storedTotal,
    window_raw: windowRaw,
    window_slim: windowSlim,
    hidden_by_compression: Math.max(0, storedTotal - runtimeMessageCount),
    runtime_message_count: runtimeMessageCount,
    messages_until_recompress: messagesUntil,
    rounds_until_recompress: roundsUntil,
    context_tokens_est: tokensEst,
    effective_budget: budget,
    usage_ratio: usageRatio,
    context_window: window,
    context_window_source: source,
    has_summary: Boolean(state?.summary),
  };
}

/** Whether this turn will advance compression boundary (does not run deriveBoundariesFromL4) */
export function willAdvanceCompression(messages: StoredMessage[], opts?: CompressOptions): boolean {
  const cfg = getCompressionConfig();
  const maxRounds = opts?.maxRounds ?? cfg.maxRounds;
  const state = opts?.state ?? null;
  const model = opts?.model ?? "";
  const { threshold, recompressAt } = messageThreshold(maxRounds);
  const { budget } = resolveCompressBudget(model, opts);
  const tokenMode = budget != null;

  const rest = restMessages(messages);
  const l4 = getL4(messages);
  const systemPrompt = opts?.systemPrompt ?? "";
  const compressed = isCompressed(state);

  const runtimeBody = buildRuntimeFromLPoints(messages, state);
  const tokensEst = buildRuntimeEstimate(runtimeBody, systemPrompt, opts?.tools, model);
  const usageRatio = budget != null && budget > 0 ? tokensEst / budget : null;

  const inToolLoop = isInToolLoop(messages);
  const rawLen = compressed && state ? rawSegment(rest, state.l3, l4).length : rest.length;

  let messageAdvance = false;
  if (!tokenMode) {
    if (!compressed && rest.length > threshold) messageAdvance = true;
    else if (compressed && rawLen > recompressAt) messageAdvance = true;
  }

  return shouldAdvance(
    omitUndefined({
      usageRatio,
      inToolLoop: opts?.force ? false : inToolLoop,
      hasCompressed: compressed,
      triggerLow: cfg.triggerLow,
      triggerHigh: cfg.triggerHigh,
      emergencyRatio: cfg.emergencyRatio,
      forceEmergency: opts?.forceEmergency,
      force: opts?.force,
      messageAdvance: opts?.force ? true : messageAdvance,
    }),
  ).advance;
}

/**
 * Stateful compression: archive unchanged; runtime four-segment view + meta l2/l3.
 */
export function compress(
  messages: StoredMessage[],
  opts?: CompressOptions,
): [StoredMessage[], CompressionState | null] {
  const cfg = getCompressionConfig();
  const state = opts?.state ?? null;

  const system = messages.filter((m) => m.role === "system");
  const compressed = isCompressed(state);

  if (!willAdvanceCompression(messages, opts)) {
    const view = buildRuntimeFromLPoints(messages, state);
    return [[...system, ...view], compressed ? state : null];
  }

  const l4 = getL4(messages);
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

/** Summary incremental range (old l2, new l2] */
export function sliceForSummary(
  messages: StoredMessage[],
  prevL2: number | null,
  newL2: number,
): StoredMessage[] {
  const rest = restMessages(messages);
  const lo = prevL2 ?? 0;
  return rest.filter((m) => {
    const pos = messagePos(m);
    return !Number.isNaN(pos) && pos > lo && pos <= newL2;
  });
}

export function formatMessagesForSummary(msgs: StoredMessage[]): string {
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
        const content = (m.content ?? "").slice(0, 4000);
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
