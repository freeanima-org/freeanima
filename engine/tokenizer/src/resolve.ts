import { FALLBACK_TOKENIZER_REPO, HF_HUB_BASE } from "./constants.ts";
import { hubResolveUrl } from "./paths.ts";
import { loadRegistry, saveRegistryEntry } from "./registry.ts";

/** kebab-case / snake segments → PascalCase (deepseek-v4-flash → DeepSeekV4Flash). */
export function toPascalCaseModel(model: string): string {
  return model
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

export function generateCandidateRepos(model: string): string[] {
  const trimmed = model.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const add = (repo: string | undefined | null): void => {
    const r = repo?.trim();
    if (!r || !r.includes("/") || seen.has(r)) return;
    seen.add(r);
  };

  if (trimmed.includes("/")) {
    add(trimmed);
    return [...seen];
  }

  const pascal = toPascalCaseModel(trimmed);
  const lower = trimmed.toLowerCase();

  if (lower.startsWith("bge-") || lower.startsWith("bge_")) {
    add(`BAAI/${trimmed}`);
  }

  if (lower.startsWith("deepseek-") || lower.startsWith("deepseek_")) {
    add(`deepseek-ai/${pascal}`);
    add(`deepseek-ai/${trimmed}`);
  }

  add(trimmed);
  return [...seen];
}

export async function headTokenizerJsonExists(repo: string): Promise<boolean> {
  try {
    const res = await fetch(hubResolveUrl(repo, "tokenizer.json"), { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

type HubModelEntry = {
  id?: string;
  modelId?: string;
  siblings?: Array<{ rfilename?: string }>;
};

export async function searchHubForTokenizerRepo(model: string): Promise<string[]> {
  const url = `${HF_HUB_BASE}/api/models?search=${encodeURIComponent(model)}&sort=downloads&direction=-1&limit=10`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const entries = (await res.json()) as HubModelEntry[];
    const repos: string[] = [];
    for (const entry of entries) {
      const id = entry.id ?? entry.modelId;
      if (!id) continue;
      const hasTokenizer = entry.siblings?.some((s) => s.rfilename === "tokenizer.json");
      if (hasTokenizer) repos.push(id);
    }
    return repos;
  } catch {
    return [];
  }
}

export async function resolveTokenizerRepo(model: string): Promise<string | null> {
  const trimmed = model.trim();
  if (!trimmed) return null;

  const cached = loadRegistry()[trimmed];
  if (cached && (await headTokenizerJsonExists(cached))) {
    return cached;
  }

  const candidates = [
    ...generateCandidateRepos(trimmed),
    ...(await searchHubForTokenizerRepo(trimmed)),
  ];

  for (const repo of candidates) {
    if (await headTokenizerJsonExists(repo)) {
      saveRegistryEntry(trimmed, repo);
      return repo;
    }
  }

  return null;
}

export { FALLBACK_TOKENIZER_REPO };
