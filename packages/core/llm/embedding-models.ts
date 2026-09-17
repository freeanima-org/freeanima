/**
 * 文本嵌入模型筛选：按命名启发 / 输出模态过滤。
 * Ollama 等 OpenAI 兼容 `/models` 常把 chat 与 embed 混在一起。
 */

export type EmbeddingCatalogEntry = {
  model: string;
  label?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  outputModalities?: readonly string[];
};

/** 常见 embedding 模型 id（含 Ollama 标签后缀 :latest） */
const EMBEDDING_ID_RE =
  /(^|[-_/])(bge|e5|gte|embed|embedding|text-embedding|nomic-embed|mxbai-embed|jina-embed|snowflake-arctic-embed|all-minilm|paraphrase-multilingual|multilingual-e5|qwen3?-embedding)([-_/:]|$)/i;

export function looksLikeEmbeddingModelId(modelId: string): boolean {
  const id = modelId.trim();
  if (!id) return false;
  if (EMBEDDING_ID_RE.test(id)) return true;
  if (/\bembed(ding)?s?\b/i.test(id)) return true;
  return false;
}

function matchesQuery(model: string, label: string | undefined, q: string): boolean {
  if (!q) return true;
  return `${model} ${label ?? ""}`.toLowerCase().includes(q);
}

function isEmbeddingCapable(entry: EmbeddingCatalogEntry): boolean {
  if (entry.outputModalities?.includes("embedding")) return true;
  return looksLikeEmbeddingModelId(entry.model);
}

/** 文本嵌入场景：只保留向量模型 */
export function filterEmbeddingCatalog<T extends EmbeddingCatalogEntry>(
  catalog: readonly T[],
  opts?: { query?: string; limit?: number },
): T[] {
  const limit = opts?.limit ?? 200;
  const q = opts?.query?.trim().toLowerCase() ?? "";
  const out: T[] = [];
  for (const entry of catalog) {
    if (!isEmbeddingCapable(entry)) continue;
    if (!matchesQuery(entry.model, entry.label, q)) continue;
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

/** 对话 / 文本生成场景：排除向量模型（仍允许手填任意 id） */
export function filterChatCatalog<T extends EmbeddingCatalogEntry>(
  catalog: readonly T[],
  opts?: { query?: string; limit?: number },
): T[] {
  const limit = opts?.limit ?? 200;
  const q = opts?.query?.trim().toLowerCase() ?? "";
  const out: T[] = [];
  for (const entry of catalog) {
    if (isEmbeddingCapable(entry)) continue;
    if (!matchesQuery(entry.model, entry.label, q)) continue;
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}
