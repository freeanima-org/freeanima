/**
 * 文生声 / 实时语音模型筛选（排除 ASR）。
 */

import {
  alibabaTokenPlanModelLabel,
  filterAlibabaTokenPlanModels,
  type AlibabaTokenPlanCapability,
  type AlibabaTokenPlanModel,
} from "./alibaba-token-plan-models.ts";

export type VoiceGenCatalogEntry = {
  model: string;
  label?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  outputModalities?: readonly string[];
};

const DEFAULT_CTX = 128_000;
const DEFAULT_OUT = 8192;

const VOICE_SYNTHESIS_CAPABILITIES: readonly AlibabaTokenPlanCapability[] = [
  "语音合成",
  "实时语音合成",
  "实时语音对话",
];

const REALTIME_MODEL_RE = /realtime/i;

export function looksLikeVoiceGenerateModelId(modelId: string): boolean {
  const id = modelId.trim();
  if (!id) return false;
  if (/(^|[-_/])(tts|speech|audio-tts|cosyvoice)([-_/]|$)/i.test(id)) return true;
  if (/qwen-audio/i.test(id) && !/asr/i.test(id)) return true;
  return false;
}

export function isAlibabaRealtimeVoiceModel(modelId: string): boolean {
  return REALTIME_MODEL_RE.test(modelId.trim());
}

function rowIsVoiceSynthesis(row: AlibabaTokenPlanModel): boolean {
  return row.capabilities.some((c) =>
    (VOICE_SYNTHESIS_CAPABILITIES as readonly string[]).includes(c),
  );
}

/** 阿里云 Token Plan 内置语音合成相关模型（不含 ASR） */
export function alibabaBuiltinVoiceGenerateEntries(opts?: {
  query?: string;
  limit?: number;
  /** 仅实时对话模型 */
  realtimeOnly?: boolean;
}): VoiceGenCatalogEntry[] {
  const limit = opts?.limit ?? 200;
  const q = opts?.query?.trim().toLowerCase() ?? "";
  const rows = filterAlibabaTokenPlanModels(q ? { query: q } : {}).filter((row) => {
    if (!rowIsVoiceSynthesis(row)) return false;
    if (opts?.realtimeOnly) return isAlibabaRealtimeVoiceModel(row.model);
    return true;
  });
  return rows.slice(0, limit).map((row) => ({
    model: row.model,
    label: alibabaTokenPlanModelLabel(row),
    contextWindow: DEFAULT_CTX,
    maxOutputTokens: DEFAULT_OUT,
    outputModalities: ["audio"] as const,
  }));
}

export function filterVoiceGenerateCatalog<T extends VoiceGenCatalogEntry>(
  catalog: readonly T[],
  opts?: { query?: string; limit?: number },
): T[] {
  const limit = opts?.limit ?? 200;
  const q = opts?.query?.trim().toLowerCase() ?? "";
  const matchesQuery = (model: string, label?: string) => {
    if (!q) return true;
    return `${model} ${label ?? ""}`.toLowerCase().includes(q);
  };
  const out: T[] = [];
  for (const entry of catalog) {
    if (/asr/i.test(entry.model)) continue;
    if (
      !(entry.outputModalities?.includes("audio") || looksLikeVoiceGenerateModelId(entry.model))
    ) {
      continue;
    }
    if (!matchesQuery(entry.model, entry.label)) continue;
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}
