/** LlmCallParams top-level keys + invocation capabilities (tools / streaming / reasoning) */
export type LlmParamKey = keyof LlmCallParams;

export type ExtendedParamKey = "tools" | "reasoning" | "streaming";

export type SupportedParam = LlmParamKey | ExtendedParamKey;

export type LlmCallParams = {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  stop?: string | string[];
  extra?: Record<string, unknown>;
};

export const LLM_PARAM_KEYS = [
  "temperature",
  "maxOutputTokens",
  "topP",
  "stop",
  "extra",
] as const satisfies readonly LlmParamKey[];

export const EXTENDED_PARAM_KEYS = [
  "tools",
  "reasoning",
  "streaming",
] as const satisfies readonly ExtendedParamKey[];

/** Optional pricing metadata (USD per 1M tokens), typically from models.dev. */
export type ModelCostInfo = {
  input?: number;
  output?: number;
};

/** models.dev `modalities.input` 子集（固定展示顺序）。 */
export const MODEL_INPUT_MODALITIES = ["text", "image", "audio", "video", "pdf"] as const;
export type ModelInputModality = (typeof MODEL_INPUT_MODALITIES)[number];

/** models.dev `modalities.output` 子集。 */
export const MODEL_OUTPUT_MODALITIES = ["text", "image", "audio", "video"] as const;
export type ModelOutputModality = (typeof MODEL_OUTPUT_MODALITIES)[number];

export type ModelInfo = {
  model: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportedParams?: SupportedParam[];
  label?: string;
  /** USD per 1M tokens when known (e.g. models.dev enrich). */
  cost?: ModelCostInfo;
  /**
   * 是否支持图像输入。undefined = 未知（允许尝试，由上游报错）。
   * false = 明确不支持（发送图片时应拒绝）。
   */
  supportsVision?: boolean;
  /** 已知输入模态；缺省 = 未知（勿臆造「仅文字」）。 */
  inputModalities?: ModelInputModality[];
  /** 已知输出模态；缺省 = 未知。含 image 时可用于文生图筛选。 */
  outputModalities?: ModelOutputModality[];
};

export function modelSupports(info: ModelInfo, key: SupportedParam): boolean {
  if (!info.supportedParams?.length) return true;
  return info.supportedParams.includes(key);
}

export function mergeCallParams(...layers: (Partial<LlmCallParams> | undefined)[]): LlmCallParams {
  const result: LlmCallParams = {};
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.temperature !== undefined) result.temperature = layer.temperature;
    if (layer.maxOutputTokens !== undefined) result.maxOutputTokens = layer.maxOutputTokens;
    if (layer.topP !== undefined) result.topP = layer.topP;
    if (layer.stop !== undefined) result.stop = layer.stop;
    if (layer.extra !== undefined) {
      result.extra = { ...result.extra, ...layer.extra };
    }
  }
  return result;
}

export function clampCallParams(params: LlmCallParams, modelInfo: ModelInfo): LlmCallParams {
  const clamped: LlmCallParams = { ...params };

  if (clamped.maxOutputTokens != null && modelInfo.maxOutputTokens > 0) {
    clamped.maxOutputTokens = Math.min(clamped.maxOutputTokens, modelInfo.maxOutputTokens);
  }

  if (!modelInfo.supportedParams?.length) {
    return clamped;
  }

  const allowed = new Set(modelInfo.supportedParams);
  const filtered: LlmCallParams = {};

  if (allowed.has("temperature") && clamped.temperature !== undefined) {
    filtered.temperature = clamped.temperature;
  }
  if (allowed.has("maxOutputTokens") && clamped.maxOutputTokens !== undefined) {
    filtered.maxOutputTokens = clamped.maxOutputTokens;
  }
  if (allowed.has("topP") && clamped.topP !== undefined) {
    filtered.topP = clamped.topP;
  }
  if (allowed.has("stop") && clamped.stop !== undefined) {
    filtered.stop = clamped.stop;
  }
  if (allowed.has("extra") && clamped.extra !== undefined) {
    filtered.extra = clamped.extra;
  }

  return filtered;
}
