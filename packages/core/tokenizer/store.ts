import { estimateTokenCount, splitByTokens } from "tokenx";

import { getRuntimeLogger } from "@freeanima/core/config";

import { FALLBACK_TOKENIZER_REPO, TOKENX_ESTIMATE_REPO } from "./constants.ts";
import { createTokenizerFromEncode, type TokenizerInstance } from "./instance.ts";

function tokenizerLog() {
  return getRuntimeLogger().with({ component: "tokenizer" });
}

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

let testEncodeByRepo: Map<string, (text: string) => number[]> | null = null;

export function setTokenizerEncodeForTest(repo: string, encode: (text: string) => number[]): void {
  if (!testEncodeByRepo) testEncodeByRepo = new Map();
  testEncodeByRepo.set(repo, encode);
  repoInstances.set(repo, createTokenizerFromEncode(repo, encode));
}

export function resetTokenizerForTest(): void {
  testEncodeByRepo = null;
  repoInstances.clear();
  modelBindings.clear();
  stopTokenizerReconcileForTest();
}

/** @deprecated No-op: HF reconcile removed; kept for testing teardown compatibility. */
export function stopTokenizerReconcileForTest(): void {
  /* no timer after tokenx switch */
}

function bindModel(model: string, primaryRepo: string | null, activeRepo: string): void {
  modelBindings.set(model, {
    model,
    primaryRepo,
    activeRepo,
    usingFallback: primaryRepo == null || activeRepo !== primaryRepo,
  });
  maybeReleaseUnusedFallback(activeRepo);
}

function isRepoReferenced(repo: string): boolean {
  for (const binding of modelBindings.values()) {
    if (binding.activeRepo === repo) return true;
  }
  return false;
}

/** Drop cached tokenizer instance when no model binding references it. */
export function releaseTokenizerRepo(repo: string): boolean {
  if (!repoInstances.has(repo)) return false;
  if (isRepoReferenced(repo)) return false;
  if (repo === TOKENX_ESTIMATE_REPO) return false;
  repoInstances.delete(repo);
  return true;
}

function maybeReleaseUnusedFallback(activeRepo: string): void {
  if (activeRepo === FALLBACK_TOKENIZER_REPO) return;
  if (isRepoReferenced(FALLBACK_TOKENIZER_REPO)) return;
  releaseTokenizerRepo(FALLBACK_TOKENIZER_REPO);
}

/** Unit tests: bind model to a resolved primary repo. */
export function bindModelForTest(model: string, primaryRepo: string, activeRepo: string): void {
  bindModel(model.trim(), primaryRepo, activeRepo);
}

/** Unit tests: bind model to loaded fallback without Habitat resolve. */
export function bindModelToFallbackForTest(model: string): void {
  bindModel(model.trim(), null, FALLBACK_TOKENIZER_REPO);
}

function ensureTokenxInstance(): TokenizerInstance {
  const cached = repoInstances.get(TOKENX_ESTIMATE_REPO);
  if (cached) return cached;
  // encode unused in production (countTokens uses estimateTokenCount); placeholder for maps/status.
  const instance = createTokenizerFromEncode(TOKENX_ESTIMATE_REPO, () => []);
  repoInstances.set(TOKENX_ESTIMATE_REPO, instance);
  return instance;
}

/** Ensure heuristic estimator is registered (no vocab download). */
export async function ensureFallbackTokenizer(): Promise<void> {
  if (
    testEncodeByRepo?.has(FALLBACK_TOKENIZER_REPO) &&
    repoInstances.has(FALLBACK_TOKENIZER_REPO)
  ) {
    return;
  }
  ensureTokenxInstance();
}

/** Bind model to in-process tokenx estimate (no HF / tiktoken preload). */
export async function ensureTokenizer(model: string): Promise<void> {
  const trimmed = model.trim();
  ensureTokenxInstance();
  if (!trimmed) return;
  bindModel(trimmed, TOKENX_ESTIMATE_REPO, TOKENX_ESTIMATE_REPO);
}

/** @deprecated No-op: primary path is always tokenx; kept for protocol/API compatibility. */
export async function reconcileTokenizer(model: string): Promise<boolean> {
  const trimmed = model.trim();
  if (!trimmed) return false;
  await ensureTokenizer(trimmed);
  return false;
}

/** @deprecated No-op after tokenx switch. */
export function startTokenizerReconcile(_intervalMs?: number): void {
  tokenizerLog().debug("tokenizer reconcile skipped (tokenx estimate)");
}

function getActiveRepo(model: string): string {
  const binding = modelBindings.get(model.trim());
  if (binding) return binding.activeRepo;
  return TOKENX_ESTIMATE_REPO;
}

export function getActiveTokenizerRepo(model: string): string {
  return getActiveRepo(model);
}

export function isTokenizerReady(model: string): boolean {
  const repo = getActiveRepo(model);
  if (repo === TOKENX_ESTIMATE_REPO) return true;
  return repoInstances.has(repo);
}

export function isUsingFallbackTokenizer(model: string): boolean {
  const binding = modelBindings.get(model.trim());
  return binding?.usingFallback ?? false;
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

export function listLoadedTokenizerRepos(): string[] {
  return [...repoInstances.keys()];
}

function usesTestEncode(model: string): boolean {
  if (!testEncodeByRepo) return false;
  const repo = getActiveRepo(model);
  if (testEncodeByRepo.has(repo)) return true;
  if (repo !== FALLBACK_TOKENIZER_REPO && testEncodeByRepo.has(FALLBACK_TOKENIZER_REPO)) {
    return true;
  }
  return false;
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
  if (usesTestEncode(model)) {
    const ids = encodeWithRepo(trimmed, getActiveRepo(model));
    return ids.length > 0 ? ids.length : 0;
  }
  return estimateTokenCount(trimmed);
}

export function splitTextByTokenLimit(text: string, maxTokens: number, model: string): string[] {
  const trimmed = text.trim();
  if (!trimmed || maxTokens <= 0) return [];

  if (!usesTestEncode(model)) {
    if (estimateTokenCount(trimmed) <= maxTokens) return [trimmed];
    return splitByTokens(trimmed, maxTokens).filter((c) => c.length > 0);
  }

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
