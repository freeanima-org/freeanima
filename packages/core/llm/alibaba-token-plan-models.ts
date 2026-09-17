/**
 * 阿里云 Token Plan 内置模型目录（产品页公开列表；非 /models 实时拉取）。
 * 用途筛选靠 capabilities，勿与对话 /models 混用。
 */

export type AlibabaTokenPlanBrand = "千问" | "万相" | "HappyHorse" | "DeepSeek" | "智谱AI";

export type AlibabaTokenPlanCapability =
  | "文本生成"
  | "推理模型"
  | "视觉理解"
  | "图片生成"
  | "语音识别"
  | "语音合成"
  | "实时语音合成"
  | "实时语音对话"
  | "视频生成";

export type AlibabaTokenPlanModel = {
  brand: AlibabaTokenPlanBrand;
  model: string;
  /** 展示名；缺省用 model id */
  label?: string;
  capabilities: readonly AlibabaTokenPlanCapability[];
  note?: string;
};

/** 与阿里云 Token Plan 控制台公开模型对齐的内置表 */
export const ALIBABA_TOKEN_PLAN_MODELS: readonly AlibabaTokenPlanModel[] = [
  {
    brand: "千问",
    model: "qwen3.8-max",
    capabilities: ["文本生成", "推理模型", "视觉理解"],
    note: "限时夜间5折",
  },
  {
    brand: "千问",
    model: "qwen3.7-plus",
    capabilities: ["文本生成", "推理模型", "视觉理解"],
  },
  {
    brand: "千问",
    model: "qwen3.7-max",
    capabilities: ["文本生成", "推理模型"],
  },
  {
    brand: "千问",
    model: "qwen3.6-flash",
    capabilities: ["文本生成", "推理模型", "视觉理解"],
  },
  {
    brand: "千问",
    model: "qwen-image-3.0-pro",
    label: "千问 · qwen-image-3.0-pro",
    capabilities: ["图片生成"],
  },
  {
    brand: "千问",
    model: "qwen-audio-3.0-asr-flash",
    capabilities: ["语音识别"],
  },
  {
    brand: "千问",
    model: "qwen-audio-3.0-tts-plus",
    capabilities: ["实时语音合成", "语音合成"],
  },
  {
    brand: "千问",
    model: "qwen-audio-3.0-realtime-plus",
    capabilities: ["实时语音对话"],
  },
  {
    brand: "万相",
    model: "wan2.7-image",
    label: "万相 · wan2.7-image",
    capabilities: ["图片生成"],
  },
  {
    brand: "万相",
    model: "wan2.7-image-pro",
    label: "万相 · wan2.7-image-pro",
    capabilities: ["图片生成"],
  },
  {
    brand: "HappyHorse",
    model: "happyhorse-1.1-i2v",
    capabilities: ["视频生成"],
  },
  {
    brand: "HappyHorse",
    model: "happyhorse-1.1-t2v",
    capabilities: ["视频生成"],
  },
  {
    brand: "HappyHorse",
    model: "happyhorse-1.1-r2v",
    capabilities: ["视频生成"],
  },
  {
    brand: "DeepSeek",
    model: "deepseek-v4-pro-0813",
    capabilities: ["文本生成", "推理模型"],
    note: "限时夜间5折",
  },
  {
    brand: "DeepSeek",
    model: "deepseek-v4-pro",
    capabilities: ["文本生成", "推理模型"],
  },
  {
    brand: "DeepSeek",
    model: "deepseek-v4-flash-0731",
    capabilities: ["文本生成", "推理模型"],
  },
  {
    brand: "智谱AI",
    model: "glm-5.2",
    capabilities: ["文本生成", "推理模型"],
  },
] as const;

export function filterAlibabaTokenPlanModels(opts?: {
  capability?: AlibabaTokenPlanCapability;
  query?: string;
}): AlibabaTokenPlanModel[] {
  const q = opts?.query?.trim().toLowerCase() ?? "";
  const need = opts?.capability;
  return ALIBABA_TOKEN_PLAN_MODELS.filter((row) => {
    if (need && !row.capabilities.includes(need)) return false;
    if (!q) return true;
    const hay =
      `${row.brand} ${row.model} ${row.label ?? ""} ${row.capabilities.join(" ")} ${row.note ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function alibabaTokenPlanModelLabel(row: AlibabaTokenPlanModel): string {
  if (row.label) return row.label;
  return `${row.brand} · ${row.model}`;
}
