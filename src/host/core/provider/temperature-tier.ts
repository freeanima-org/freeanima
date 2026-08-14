import { z } from "zod";

import {
  clampCallParams,
  type LlmCallParams,
  type ModelInfo,
  type SupportedParam,
} from "./model.ts";

/** 与 llm-config format id 对齐（provider 层不反向依赖 config schema） */
const FORMAT_OPENAI_COMPATIBLE = "openai_compatible";
const FORMAT_OPENAI_RESPONSES = "openai_responses";
const FORMAT_ANTHROPIC_MESSAGES = "anthropic_messages";

/** 子代理 / 采样档位（产品枚举；绝对值由区间映射得出） */
export const TEMPERATURE_TIERS = ["focused", "balanced", "creative"] as const;
export type TemperatureTier = (typeof TEMPERATURE_TIERS)[number];

export const temperatureTierSchema = z.enum(TEMPERATURE_TIERS);

export const TEMPERATURE_TIER_LABELS_ZH = {
  focused: "专注",
  balanced: "平衡",
  creative: "发散",
} as const satisfies Record<TemperatureTier, string>;

/** 区间内相对比例（与厂商无关） */
export const TEMPERATURE_TIER_RATIOS = {
  focused: { temperature: 0.2, topP: 0.8 },
  balanced: { temperature: 0.6, topP: 0.9 },
  creative: { temperature: 1.0, topP: 0.95 },
} as const satisfies Record<TemperatureTier, { temperature: number; topP: number }>;

export type ParamRange = { min: number; max: number };

export type SamplingRanges = {
  temperature: ParamRange;
  topP: ParamRange;
};

/** 默认采样区间：未知族不猜宽程 */
export const DEFAULT_SAMPLING_RANGES: SamplingRanges = {
  temperature: { min: 0, max: 1 },
  topP: { min: 0, max: 1 },
};

const OPENAI_FAMILY_FORMATS = new Set<string>([FORMAT_OPENAI_COMPATIBLE, FORMAT_OPENAI_RESPONSES]);

/** Claude 经 OpenRouter 等 compatible 转发时仍应保持 [0,1] */
export function isClaudeModelId(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  if (!id) return false;
  return /(^|\/)claude([/-]|$)/.test(id) || id.includes("claude");
}

/**
 * 默认 [0,1]；模型族微调覆盖。
 * Claude / anthropic_messages 显式保持默认，避免 openai_compatible 误扩到 2。
 */
export function resolveSamplingRanges(format: string | undefined, modelId: string): SamplingRanges {
  const ranges: SamplingRanges = {
    temperature: { ...DEFAULT_SAMPLING_RANGES.temperature },
    topP: { ...DEFAULT_SAMPLING_RANGES.topP },
  };

  if (format === FORMAT_ANTHROPIC_MESSAGES || isClaudeModelId(modelId)) {
    return ranges;
  }

  if (format && OPENAI_FAMILY_FORMATS.has(format)) {
    ranges.temperature = { min: 0, max: 2 };
  }

  return ranges;
}

function mapRatioToRange(ratio: number, range: ParamRange): number {
  const span = range.max - range.min;
  const raw = range.min + ratio * span;
  return Math.round(raw * 100) / 100;
}

export type TemperatureTierToParamsOpts = {
  /** 有 ModelInfo 时按 supportedParams 过滤；anthropic 优先只写 temperature */
  modelInfo?: Pick<ModelInfo, "supportedParams">;
  /** 强制 format 语义（如 anthropic 勿同时传 top_p） */
  format?: string;
};

function supports(
  info: Pick<ModelInfo, "supportedParams"> | undefined,
  key: SupportedParam,
): boolean {
  if (!info?.supportedParams?.length) return true;
  return info.supportedParams.includes(key);
}

/**
 * 档位 → LlmCallParams。temperature / topP 落在给定区间；再按能力与 format 决定写出哪些 key。
 */
export function temperatureTierToCallParams(
  tier: TemperatureTier,
  ranges: SamplingRanges = DEFAULT_SAMPLING_RANGES,
  opts?: TemperatureTierToParamsOpts,
): Partial<LlmCallParams> {
  const ratios = TEMPERATURE_TIER_RATIOS[tier];
  const temperature = mapRatioToRange(ratios.temperature, ranges.temperature);
  const topP = mapRatioToRange(ratios.topP, ranges.topP);

  const format = opts?.format;
  const info = opts?.modelInfo;
  const canTemp = supports(info, "temperature");
  const canTopP = supports(info, "topP");

  const out: Partial<LlmCallParams> = {};

  if (format === FORMAT_ANTHROPIC_MESSAGES) {
    if (canTemp) {
      out.temperature = temperature;
    } else if (canTopP) {
      out.topP = topP;
    }
  } else {
    if (canTemp) out.temperature = temperature;
    if (canTopP) out.topP = topP;
  }

  if (info?.supportedParams?.length) {
    return clampCallParams(out, {
      model: "",
      contextWindow: 0,
      maxOutputTokens: 0,
      supportedParams: info.supportedParams,
    });
  }

  return out;
}
