import { logComponent } from "@freeanima/service-logging";

import { FALLBACK_TOKENIZER_REPO } from "./constants.ts";
import {
  createTokenizerFromEncode,
  loadTokenizerFromRepo,
  type TokenizerInstance,
} from "./load.ts";
import {
  isTiktokenModel,
  NATIVE_TIKTOKEN_REPO,
  resetTiktokenForTest,
  tiktokenEncode,
} from "./native-tiktoken.ts";
import { resolveTokenizerRepoWithMeta } from "./resolve.ts";

const log = logComponent("tokenizer");

const RECONCILE_INTERVAL_MS = 6 * 60 * 60 * 1000;

type ModelBinding = {
  model: string;
  primaryRepo: string | null;
  activeRepo: string;
  usingFallback: boolean;
};

export type TokenizerBindingSnapshot = {
  model: string;
  repo: string;
  using_fallback: boolean;
};

const repoInstances = new Map<string, TokenizerInstance>();
const modelBindings = new Map<string, ModelBinding>();
const loadPromises = new Map<string, Promise<TokenizerInstance>>();

let testEncodeByRepo: Map<string, (text: string) => number[]> | null = null;
let reconcileTimer: ReturnType<typeof setInterval> | null = null;

export function setTokenizerEncodeForTest(repo: string, encode: (text: string) => number[]): void {
  if (!testEncodeByRepo) testEncodeByRepo = new Map();
  testEncodeByRepo.set(repo, encode);
  repoInstances.set(repo, createTokenizerFromEncode(repo, encode));
}

export function resetTokenizerForTest(): void {
  testEncodeByRepo = null;
  repoInstances.clear();
  modelBindings.clear();
  loadPromises.clear();
  stopTokenizerReconcileForTest();
  resetTiktokenForTest();
}

export function stopTokenizerReconcileForTest(): void {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }
}

async function loadRepo(repo: string): Promise<TokenizerInstance> {
  const cached = repoInstances.get(repo);
  if (cached) return cached;

  const pending = loadPromises.get(repo);
  if (pending) return pending;

  const promise = (async () => {
    const testEncode = testEncodeByRepo?.get(repo);
    const instance = testEncode
      ? createTokenizerFromEncode(repo, testEncode)
      : await loadTokenizerFromRepo(repo);
    repoInstances.set(repo, instance);
    loadPromises.delete(repo);
    return instance;
  })();

  loadPromises.set(repo, promise);
  return promise;
}

function bindModel(model: string, primaryRepo: string | null, activeRepo: string): void {
  modelBindings.set(model, {
    model,
    primaryRepo,
    activeRepo,
    usingFallback: primaryRepo == null || activeRepo !== primaryRepo,
  });
}

/** Unit tests: bind model to loaded fallback without Hub resolve. */
export function bindModelToFallbackForTest(model: string): void {
  bindModel(model.trim(), null, FALLBACK_TOKENIZER_REPO);
}

async function ensureNativeTiktoken(): Promise<void> {
  if (repoInstances.has(NATIVE_TIKTOKEN_REPO)) return;
  repoInstances.set(
    NATIVE_TIKTOKEN_REPO,
    createTokenizerFromEncode(NATIVE_TIKTOKEN_REPO, tiktokenEncode),
  );
}

export async function ensureFallbackTokenizer(): Promise<void> {
  await loadRepo(FALLBACK_TOKENIZER_REPO);
}

export async function ensureTokenizer(model: string): Promise<void> {
  const trimmed = model.trim();
  if (!trimmed) {
    await ensureFallbackTokenizer();
    return;
  }

  const existing = modelBindings.get(trimmed);
  if (existing && !existing.usingFallback && repoInstances.has(existing.activeRepo)) {
    return;
  }

  if (isTiktokenModel(trimmed)) {
    await ensureNativeTiktoken();
    bindModel(trimmed, NATIVE_TIKTOKEN_REPO, NATIVE_TIKTOKEN_REPO);
    return;
  }

  const { repo: primaryRepo, meta } = await resolveTokenizerRepoWithMeta(trimmed);
  if (primaryRepo) {
    try {
      await loadRepo(primaryRepo);
      bindModel(trimmed, primaryRepo, primaryRepo);
      return;
    } catch (err) {
      log.warn("tokenizer primary load failed, using fallback", {
        model: trimmed,
        repo: primaryRepo,
        candidates_tried: meta.candidatesTried,
        search_queries: meta.searchQueries,
        error: String(err),
      });
    }
  } else {
    log.warn("tokenizer resolve failed, using fallback", {
      model: trimmed,
      candidates_tried: meta.candidatesTried,
      search_queries: meta.searchQueries,
    });
  }

  await ensureFallbackTokenizer();
  bindModel(trimmed, primaryRepo, FALLBACK_TOKENIZER_REPO);
}

export async function reconcileTokenizer(model: string): Promise<boolean> {
  const trimmed = model.trim();
  if (!trimmed) return false;

  const binding = modelBindings.get(trimmed);
  if (binding && !binding.usingFallback) return false;

  if (isTiktokenModel(trimmed)) {
    await ensureNativeTiktoken();
    bindModel(trimmed, NATIVE_TIKTOKEN_REPO, NATIVE_TIKTOKEN_REPO);
    return true;
  }

  const { repo: primaryRepo, meta } = await resolveTokenizerRepoWithMeta(trimmed);
  if (!primaryRepo) {
    log.debug("tokenizer reconcile still unresolved", {
      model: trimmed,
      candidates_tried: meta.candidatesTried,
      search_queries: meta.searchQueries,
    });
    return false;
  }

  try {
    await loadRepo(primaryRepo);
    bindModel(trimmed, primaryRepo, primaryRepo);
    log.info("tokenizer reconcile succeeded", { model: trimmed, repo: primaryRepo });
    return true;
  } catch (err) {
    log.warn("tokenizer reconcile load failed", {
      model: trimmed,
      repo: primaryRepo,
      error: String(err),
    });
    return false;
  }
}

async function runTokenizerReconcile(): Promise<void> {
  for (const binding of modelBindings.values()) {
    if (!binding.usingFallback) continue;
    await reconcileTokenizer(binding.model);
  }
}

export function startTokenizerReconcile(intervalMs = RECONCILE_INTERVAL_MS): void {
  if (reconcileTimer) return;
  reconcileTimer = setInterval(() => {
    void runTokenizerReconcile();
  }, intervalMs);
}

function getActiveRepo(model: string): string {
  const binding = modelBindings.get(model.trim());
  if (binding) return binding.activeRepo;
  return FALLBACK_TOKENIZER_REPO;
}

export function getActiveTokenizerRepo(model: string): string {
  return getActiveRepo(model);
}

export function isTokenizerReady(model: string): boolean {
  return repoInstances.has(getActiveRepo(model));
}

export function isUsingFallbackTokenizer(model: string): boolean {
  const binding = modelBindings.get(model.trim());
  return binding?.usingFallback ?? true;
}

export function getTokenizerBindingSnapshot(model: string): TokenizerBindingSnapshot | null {
  const trimmed = model.trim();
  const binding = modelBindings.get(trimmed);
  if (!binding) return null;
  return {
    model: trimmed,
    repo: binding.activeRepo,
    using_fallback: binding.usingFallback,
  };
}

export function listTokenizerBindings(): TokenizerBindingSnapshot[] {
  return [...modelBindings.values()].map((b) => ({
    model: b.model,
    repo: b.activeRepo,
    using_fallback: b.usingFallback,
  }));
}

function encodeWithRepo(text: string, repo: string): number[] {
  let instance = repoInstances.get(repo);
  if (!instance && repo !== FALLBACK_TOKENIZER_REPO) {
    instance = repoInstances.get(FALLBACK_TOKENIZER_REPO);
  }
  if (!instance) return [];
  return instance.encode(text);
}

export function countTokens(text: string, model: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const ids = encodeWithRepo(trimmed, getActiveRepo(model));
  return ids.length > 0 ? ids.length : 0;
}

export function splitTextByTokenLimit(text: string, maxTokens: number, model: string): string[] {
  const trimmed = text.trim();
  if (!trimmed || maxTokens <= 0) return [];
  if (countTokens(trimmed, model) <= maxTokens) return [trimmed];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    let lo = start + 1;
    let hi = trimmed.length;
    let best = start;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const slice = trimmed.slice(start, mid);
      if (countTokens(slice, model) <= maxTokens) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (best <= start) {
      best = Math.min(start + 1, trimmed.length);
    }

    chunks.push(trimmed.slice(start, best));
    start = best;
  }

  return chunks.filter((c) => c.length > 0);
}
