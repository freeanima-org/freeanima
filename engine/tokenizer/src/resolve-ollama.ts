import { stripOllamaTag } from "./normalize.ts";

const HF_CO_RE = /(?:hf\.co|huggingface\.co)\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i;
const FROM_LINE_RE = /^FROM\s+(.+)$/im;

type OllamaShowResponse = {
  modelfile?: string;
  details?: { family?: string; parent_model?: string };
  model_info?: Record<string, unknown>;
};

/** OpenAI-compatible base URL → Ollama API root (strip /v1). */
export function ollamaApiBaseFromOpenAiUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (/\/v1$/i.test(trimmed)) return trimmed.replace(/\/v1$/i, "");
  if (trimmed.includes("11434")) return trimmed;
  return null;
}

function extractRepoFromModelfile(modelfile: string): string[] {
  const repos: string[] = [];
  const fromMatch = modelfile.match(FROM_LINE_RE);
  if (!fromMatch?.[1]) return repos;

  const from = fromMatch[1].trim();
  const hfMatch = from.match(HF_CO_RE);
  if (hfMatch?.[1]) {
    repos.push(hfMatch[1]);
    return repos;
  }

  if (from.includes("/") && !from.includes(":")) {
    repos.push(from);
  }
  return repos;
}

function extractFromModelInfo(modelInfo: Record<string, unknown> | undefined): string[] {
  if (!modelInfo) return [];
  const hints: string[] = [];
  for (const key of Object.keys(modelInfo)) {
    if (!key.endsWith("basename") && !key.endsWith("name")) continue;
    const val = modelInfo[key];
    if (typeof val !== "string" || !val.trim()) continue;
    const hfMatch = val.match(HF_CO_RE);
    if (hfMatch?.[1]) hints.push(hfMatch[1]);
    else if (val.includes("/") && !val.includes(":")) hints.push(val.trim());
  }
  return hints;
}

export async function resolveOllamaModelHints(
  model: string,
  baseUrls: string[],
): Promise<string[]> {
  const name = stripOllamaTag(model);
  if (!name) return [];

  const seen = new Set<string>();
  const hints: string[] = [];
  const add = (hint: string | undefined | null): void => {
    const h = hint?.trim();
    if (!h || !h.includes("/") || seen.has(h)) return;
    seen.add(h);
    hints.push(h);
  };

  for (const baseUrl of baseUrls) {
    const apiBase = ollamaApiBaseFromOpenAiUrl(baseUrl);
    if (!apiBase) continue;

    try {
      const res = await fetch(`${apiBase}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) continue;

      const data = (await res.json()) as OllamaShowResponse;
      if (data.modelfile) {
        for (const repo of extractRepoFromModelfile(data.modelfile)) add(repo);
      }
      for (const repo of extractFromModelInfo(data.model_info)) add(repo);
      if (data.details?.parent_model?.includes("/")) add(data.details.parent_model);
    } catch {
      // 静默降级
    }
  }

  return hints;
}
