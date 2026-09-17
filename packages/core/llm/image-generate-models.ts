/**
 * 文生图模型筛选：按目录能力 / 命名启发过滤。
 * 不注入跨厂商「常用推荐」；阿里云 Token Plan 用内置表。
 */

import {
  alibabaTokenPlanModelLabel,
  filterAlibabaTokenPlanModels,
  type AlibabaTokenPlanModel,
} from "./alibaba-token-plan-models.ts";

const IMAGE_GEN_ID_RE =
  /(^|[-_/])(dall-?e|gpt-image|wanx|wan2\.?\d*|flux|sdxl|stable-?diffusion|imagen|cogview|kolors|qwen-image|text2image|t2i|image-gen)([-_/]|$)/i;

export function looksLikeImageGenerateModelId(modelId: string): boolean {
  const id = modelId.trim();
  if (!id) return false;
  if (IMAGE_GEN_ID_RE.test(id)) return true;
  if (/\bimage\b/i.test(id) && !/(^|[-_/])(vl|vision)([-_/]|$)/i.test(id)) return true;
  return false;
}

export type ImageGenCatalogEntry = {
  model: string;
  label?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  outputModalities?: readonly string[];
};

const DEFAULT_CTX = 128_000;
const DEFAULT_OUT = 8192;

/** 阿里云 Token Plan 内置「图片生成」模型 → 目录条目 */
export function alibabaBuiltinImageGenerateEntries(opts?: {
  query?: string;
  limit?: number;
}): ImageGenCatalogEntry[] {
  const limit = opts?.limit ?? 200;
  return filterAlibabaTokenPlanModels({
    capability: "图片生成",
    ...(opts?.query != null && opts.query !== "" ? { query: opts.query } : {}),
  })
    .slice(0, limit)
    .map((row: AlibabaTokenPlanModel) => ({
      model: row.model,
      label: alibabaTokenPlanModelLabel(row),
      contextWindow: DEFAULT_CTX,
      maxOutputTokens: DEFAULT_OUT,
      outputModalities: ["image"] as const,
    }));
}

/** 从供应方目录筛文生图候选（不注入推荐列表） */
export function filterImageGenerateCatalog<T extends ImageGenCatalogEntry>(
  catalog: readonly T[],
  opts?: { query?: string; limit?: number },
): T[] {
  const limit = opts?.limit ?? 200;
  const q = opts?.query?.trim().toLowerCase() ?? "";

  const matchesQuery = (model: string, label?: string) => {
    if (!q) return true;
    return `${model} ${label ?? ""}`.toLowerCase().includes(q);
  };

  const isImageCapable = (entry: ImageGenCatalogEntry) => {
    if (entry.outputModalities?.includes("image")) return true;
    return looksLikeImageGenerateModelId(entry.model);
  };

  const out: T[] = [];
  for (const entry of catalog) {
    if (!isImageCapable(entry)) continue;
    if (!matchesQuery(entry.model, entry.label)) continue;
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}
