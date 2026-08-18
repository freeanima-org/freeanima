/**
 * 按 voice_protocol 的静态音色目录（与 listProviderModels 的合成模型分维）。
 * 不做全量上游发现；阿里仅常用系统音色。
 */

import {
  VOICE_PROTOCOL_ALIBABA_AUDIO,
  VOICE_PROTOCOL_EDGE_TTS,
  VOICE_PROTOCOL_OPENAI_AUDIO,
  type VoiceProtocolId,
} from "@freeanima/habitat/core/config/schemas/llm-config";
import { EDGE_TTS_VOICE_OPTIONS } from "./edge-voices.ts";

export type VoiceCatalogEntry = {
  id: string;
  label: string;
  lang?: string;
  /** 若指定，仅当场景 model 命中时展示（阿里音色与模型绑定） */
  models?: readonly string[];
};

/** OpenAI Audio Speech 官方内置音色（无 list API） */
export const OPENAI_AUDIO_VOICE_OPTIONS: readonly VoiceCatalogEntry[] = [
  { id: "alloy", label: "Alloy", lang: "en" },
  { id: "ash", label: "Ash", lang: "en" },
  { id: "ballad", label: "Ballad", lang: "en" },
  { id: "coral", label: "Coral", lang: "en" },
  { id: "echo", label: "Echo", lang: "en" },
  { id: "fable", label: "Fable", lang: "en" },
  { id: "onyx", label: "Onyx", lang: "en" },
  { id: "nova", label: "Nova", lang: "en" },
  { id: "sage", label: "Sage", lang: "en" },
  { id: "shimmer", label: "Shimmer", lang: "en" },
  { id: "verse", label: "Verse", lang: "en" },
  { id: "marin", label: "Marin", lang: "en" },
  { id: "cedar", label: "Cedar", lang: "en" },
] as const;

/**
 * 阿里系统音色（常用子集）。
 * qwen-audio-3.0-tts-plus：longanlingxin / longanlufeng；
 * CosyVoice 系列另列若干通用音色。
 */
export const ALIBABA_AUDIO_VOICE_OPTIONS: readonly VoiceCatalogEntry[] = [
  {
    id: "longanlingxin",
    label: "龙安灵心（女·知心温暖）",
    lang: "zh-CN",
    models: ["qwen-audio-3.0-tts-plus", "qwen-audio-3.0-tts-flash"],
  },
  {
    id: "longanlufeng",
    label: "龙安鲁风（男·明亮开朗）",
    lang: "zh-CN",
    models: ["qwen-audio-3.0-tts-plus", "qwen-audio-3.0-tts-flash"],
  },
  {
    id: "longanhuan",
    label: "龙安欢（女·欢脱元气）",
    lang: "zh-CN",
    models: ["cosyvoice-v3-plus", "cosyvoice-v3-flash", "cosyvoice-v2"],
  },
  {
    id: "longanyang",
    label: "龙安洋（男·阳光）",
    lang: "zh-CN",
    models: ["cosyvoice-v3-plus", "cosyvoice-v3-flash", "cosyvoice-v2"],
  },
  {
    id: "longxiaochun_v2",
    label: "龙小淳 v2（女）",
    lang: "zh-CN",
    models: ["cosyvoice-v2"],
  },
] as const;

function edgeCatalog(): VoiceCatalogEntry[] {
  return EDGE_TTS_VOICE_OPTIONS.map((v) => ({
    id: v.name,
    label: v.label,
    lang: v.lang,
  }));
}

function modelMatchesFilter(entry: VoiceCatalogEntry, model: string | undefined): boolean {
  if (!model?.trim()) return true;
  if (!entry.models?.length) return true;
  const m = model.trim().toLowerCase();
  return entry.models.some((allowed) => {
    const a = allowed.toLowerCase();
    return m === a || m.includes(a) || a.includes(m);
  });
}

export type ListVoiceCatalogInput = {
  protocol: VoiceProtocolId;
  /** 合成模型；阿里用于过滤音色 */
  model?: string;
  query?: string;
  limit?: number;
};

/** 按协议取静态音色目录 */
export function listVoiceCatalog(input: ListVoiceCatalogInput): VoiceCatalogEntry[] {
  const limit = input.limit ?? 200;
  const q = input.query?.trim().toLowerCase() ?? "";
  let rows: VoiceCatalogEntry[];
  switch (input.protocol) {
    case VOICE_PROTOCOL_EDGE_TTS:
      rows = edgeCatalog();
      break;
    case VOICE_PROTOCOL_OPENAI_AUDIO:
      rows = [...OPENAI_AUDIO_VOICE_OPTIONS];
      break;
    case VOICE_PROTOCOL_ALIBABA_AUDIO:
      rows = ALIBABA_AUDIO_VOICE_OPTIONS.filter((e) => modelMatchesFilter(e, input.model));
      break;
    default:
      rows = [];
  }
  const out: VoiceCatalogEntry[] = [];
  for (const entry of rows) {
    if (q) {
      const hay = `${entry.id} ${entry.label} ${entry.lang ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

/** 协议+模型下的推荐默认音色（无则 undefined） */
export function defaultVoiceIdForProtocol(
  protocol: VoiceProtocolId,
  model?: string,
): string | undefined {
  const rows = listVoiceCatalog({ protocol, ...(model ? { model } : {}), limit: 1 });
  return rows[0]?.id;
}

/** 供 tool schema description：列出常用 id */
export function formatVoiceIdsForToolHint(protocol: VoiceProtocolId, model?: string): string {
  const rows = listVoiceCatalog({ protocol, ...(model ? { model } : {}), limit: 16 });
  if (rows.length === 0) return "";
  return rows.map((r) => r.id).join(", ");
}

/** voice_protocol 是否将音色与合成模型分栏（非 Edge） */
export function voiceProtocolSeparatesModelAndVoice(protocol: string | null | undefined): boolean {
  return protocol === VOICE_PROTOCOL_OPENAI_AUDIO || protocol === VOICE_PROTOCOL_ALIBABA_AUDIO;
}
