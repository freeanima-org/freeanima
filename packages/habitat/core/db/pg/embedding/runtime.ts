import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

import { mountEmbeddingRuntimeService } from "./runtime-service.ts";
import type { AfterEmbeddingStoredFn } from "./runtime-service.ts";
import type { EmbedTextFn, EmbedTextsFn } from "./types.ts";

export type { AfterEmbeddingStoredFn };

export function registerEmbedTextFn(fn: EmbedTextFn | null): void {
  mountEmbeddingRuntimeService(ensureRootContext()).setEmbedTextFn(fn);
}

export function getEmbedTextFn(): EmbedTextFn | null {
  return getRootContextOrNull()?.embeddingRuntime?.getEmbedTextFn() ?? null;
}

export function registerEmbedTextsFn(fn: EmbedTextsFn | null): void {
  mountEmbeddingRuntimeService(ensureRootContext()).setEmbedTextsFn(fn);
}

export function getEmbedTextsFn(): EmbedTextsFn | null {
  return getRootContextOrNull()?.embeddingRuntime?.getEmbedTextsFn() ?? null;
}

export function registerAfterEmbeddingStored(fn: AfterEmbeddingStoredFn | null): void {
  mountEmbeddingRuntimeService(ensureRootContext()).setAfterEmbeddingStored(fn);
}

export function getAfterEmbeddingStored(): AfterEmbeddingStoredFn | null {
  return getRootContextOrNull()?.embeddingRuntime?.getAfterEmbeddingStored() ?? null;
}

/** Test teardown */
export function resetEmbedTextFnForTest(): void {
  getRootContextOrNull()?.embeddingRuntime?.setEmbedTextFn(null);
}

export function resetEmbedTextsFnForTest(): void {
  getRootContextOrNull()?.embeddingRuntime?.setEmbedTextsFn(null);
}

export function resetAfterEmbeddingStoredForTest(): void {
  getRootContextOrNull()?.embeddingRuntime?.setAfterEmbeddingStored(null);
}
