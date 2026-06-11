import { FALLBACK_TOKENIZER_REPO, HF_HUB_BASE } from "./constants.ts";
import { mapWithConcurrency } from "./concurrency.ts";
import {
  buildSearchQueries,
  deriveBaseModelNames,
  stripOllamaTag,
  toTitleKebabModel,
} from "./normalize.ts";
import { hubResolveUrl } from "./paths.ts";
import { getResolveContext } from "./resolve-context.ts";
import { resolveOllamaModelHints } from "./resolve-ollama.ts";
import {
  deleteRegistryEntry,
  loadRegistry,
  loadSeedRegistry,
  loadUserRegistry,
  saveRegistryEntry,
} from "./registry.ts";

const HF_SEARCH_LIMIT = 20;
const HEAD_CONCURRENCY = 5;

/** kebab-case / snake segments → PascalCase (deepseek-v4-flash → DeepseekV4Flash). */
export function toPascalCaseModel(model: string): string {
  return model
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

type PrefixRule = {
  match: (lower: string) => boolean;
  orgs: string[];
  /** deepseek-ai 使用 DeepSeek- 前缀的 Title-Kebab 名 */
  titleKebabOrg?: string;
};

const PREFIX_RULES: PrefixRule[] = [
  {
    match: (l) => l.startsWith("bge-") || l.startsWith("bge_"),
    orgs: ["BAAI"],
  },
  {
    match: (l) => l.startsWith("deepseek-") || l.startsWith("deepseek_"),
    orgs: ["deepseek-ai"],
    titleKebabOrg: "deepseek-ai",
  },
  {
    match: (l) => l.startsWith("qwen"),
    orgs: ["Qwen"],
  },
  {
    match: (l) => l.startsWith("llama"),
    orgs: ["meta-llama"],
  },
  {
    match: (l) => l.startsWith("mistral"),
    orgs: ["mistralai"],
  },
  {
    match: (l) => l.startsWith("nomic"),
    orgs: ["nomic-ai"],
  },
  {
    match: (l) => l.startsWith("mxbai"),
    orgs: ["mixedbread-ai"],
  },
];

export function generateCandidateRepos(model: string, extraHints: string[] = []): string[] {
  const trimmed = model.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const repos: string[] = [];
  const add = (repo: string | undefined | null): void => {
    const r = repo?.trim();
    if (!r || !r.includes("/") || seen.has(r)) return;
    seen.add(r);
    repos.push(r);
  };

  if (trimmed.includes("/")) {
    add(trimmed);
    return repos;
  }

  const baseName = stripOllamaTag(trimmed);
  const pascal = toPascalCaseModel(baseName);
  const titleKebab = toTitleKebabModel(baseName);
  const lower = baseName.toLowerCase();

  for (const hint of extraHints) add(hint);

  for (const rule of PREFIX_RULES) {
    if (!rule.match(lower)) continue;
    for (const org of rule.orgs) {
      add(`${org}/${baseName}`);
      add(`${org}/${pascal}`);
      add(`${org}/${titleKebab}`);
      if (rule.titleKebabOrg) {
        add(`${rule.titleKebabOrg}/DeepSeek-${titleKebab}`);
      }
    }
  }

  add(trimmed);
  return repos;
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
};

async function fetchHubSearchIds(query: string): Promise<string[]> {
  const url = `${HF_HUB_BASE}/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=${HF_SEARCH_LIMIT}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const entries = (await res.json()) as HubModelEntry[];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const id = entry.id ?? entry.modelId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

/** 对 search 结果直接 HEAD，不依赖 siblings（list API 默认无 siblings）。 */
export async function searchHubForTokenizerRepo(model: string): Promise<string[]> {
  const queries = buildSearchQueries(model);
  if (queries.length === 0) return [];

  const idSeen = new Set<string>();
  const ids: string[] = [];
  for (const query of queries) {
    for (const id of await fetchHubSearchIds(query)) {
      if (!idSeen.has(id)) {
        idSeen.add(id);
        ids.push(id);
      }
    }
  }

  const hits = await mapWithConcurrency(ids, HEAD_CONCURRENCY, async (id) => ({
    id,
    ok: await headTokenizerJsonExists(id),
  }));

  return hits.filter((h) => h.ok).map((h) => h.id);
}

export type ResolveAttemptMeta = {
  candidatesTried: string[];
  searchQueries: string[];
};

export type ResolveResult = {
  repo: string | null;
  meta: ResolveAttemptMeta;
};

async function tryCandidates(
  candidates: string[],
  meta: ResolveAttemptMeta,
): Promise<string | null> {
  for (const repo of candidates) {
    meta.candidatesTried.push(repo);
    if (await headTokenizerJsonExists(repo)) {
      return repo;
    }
  }
  return null;
}

export async function resolveTokenizerRepoWithMeta(model: string): Promise<ResolveResult> {
  const trimmed = model.trim();
  const meta: ResolveAttemptMeta = { candidatesTried: [], searchQueries: [] };
  if (!trimmed) return { repo: null, meta };

  const merged = loadRegistry();
  const cachedUser = loadUserRegistry()[trimmed];
  const cachedMerged = merged[trimmed];

  if (cachedMerged) {
    meta.candidatesTried.push(cachedMerged);
    if (await headTokenizerJsonExists(cachedMerged)) {
      return { repo: cachedMerged, meta };
    }
    if (cachedUser) {
      deleteRegistryEntry(trimmed);
    }
  }

  const seedRepo = loadSeedRegistry()[trimmed];
  if (seedRepo && seedRepo !== cachedMerged) {
    meta.candidatesTried.push(seedRepo);
    if (await headTokenizerJsonExists(seedRepo)) {
      saveRegistryEntry(trimmed, seedRepo);
      return { repo: seedRepo, meta };
    }
  }

  const { ollamaBaseUrls = [] } = getResolveContext();
  const ollamaHints =
    ollamaBaseUrls.length > 0 ? await resolveOllamaModelHints(trimmed, ollamaBaseUrls) : [];

  const seedRegistry = loadSeedRegistry();
  const userRegistry = loadUserRegistry();
  for (const baseName of deriveBaseModelNames(trimmed)) {
    if (baseName === trimmed) continue;
    const repo = userRegistry[baseName] ?? seedRegistry[baseName];
    if (!repo) continue;
    meta.candidatesTried.push(repo);
    if (await headTokenizerJsonExists(repo)) {
      saveRegistryEntry(trimmed, repo);
      return { repo, meta };
    }
  }

  const heuristicCandidates = generateCandidateRepos(trimmed, ollamaHints);
  const heuristicHit = await tryCandidates(heuristicCandidates, meta);
  if (heuristicHit) {
    saveRegistryEntry(trimmed, heuristicHit);
    return { repo: heuristicHit, meta };
  }

  if (!trimmed.includes("/")) {
    meta.searchQueries = buildSearchQueries(trimmed);
    const searchCandidates = await searchHubForTokenizerRepo(trimmed);
    for (const repo of searchCandidates) {
      meta.candidatesTried.push(repo);
      saveRegistryEntry(trimmed, repo);
      return { repo, meta };
    }
  }

  return { repo: null, meta };
}

export async function resolveTokenizerRepo(model: string): Promise<string | null> {
  const { repo } = await resolveTokenizerRepoWithMeta(model);
  return repo;
}

export { FALLBACK_TOKENIZER_REPO };
