import { fetchWithTimeout } from "./fetch.ts";
import { stripOllamaTag } from "./normalize.ts";

const HF_CO_RE = /(?:hf\.co|huggingface\.co)\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i;
const FROM_LINE_RE = /^FROM\s+(.+)$/im;
const HUB_REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** HuggingFace org/repo，排除本地 blob 路径。 */
export function isLikelyHubRepo(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.startsWith("/") && HUB_REPO_RE.test(trimmed);
}

type OllamaShowResponse = {
  modelfile?: string;
  details?: { family?: string; parent_model?: string };
  model_info?: Record<string, unknown>;
};

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end -= 1;
  return end === value.length ? value : value.slice(0, end);
}

/** OpenAI-compatible base URL → Ollama API root（仅识别 Ollama 常见端点，避免误探测其它 /v1 服务）。 */
export function ollamaApiBaseFromOpenAiUrl(baseUrl: string): string | null {
  const trimmed = stripTrailingSlashes(baseUrl.trim());
  if (!trimmed) return null;

  let host = "";
  try {
    host = new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }

  const isLocalOllama =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
  const isOllamaPort = trimmed.includes(":11434");
  const mentionsOllama = trimmed.toLowerCase().includes("ollama");

  if (!isOllamaPort && !mentionsOllama && !isLocalOllama) return null;

  if (trimmed.endsWith("/v1") || trimmed.endsWith("/V1")) {
    return trimmed.slice(0, -3);
  }
  if (isOllamaPort) return trimmed;
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

  if (!from.includes(":") && isLikelyHubRepo(from)) {
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
    else if (!val.includes(":") && isLikelyHubRepo(val)) hints.push(val.trim());
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
    if (!h || !isLikelyHubRepo(h) || seen.has(h)) return;
    seen.add(h);
    hints.push(h);
  };

  for (const baseUrl of baseUrls) {
    const apiBase = ollamaApiBaseFromOpenAiUrl(baseUrl);
    if (!apiBase) continue;

    try {
      const res = await fetchWithTimeout(`${apiBase}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) continue;

      const dataUnknown: unknown = await res.json();
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Ollama show 响应形
      const data = dataUnknown as OllamaShowResponse;
      if (data.modelfile) {
        for (const repo of extractRepoFromModelfile(data.modelfile)) add(repo);
      }
      for (const repo of extractFromModelInfo(data.model_info)) add(repo);
      if (data.details?.parent_model) add(data.details.parent_model);
    } catch {
      // 静默降级
    }
  }

  return hints;
}
