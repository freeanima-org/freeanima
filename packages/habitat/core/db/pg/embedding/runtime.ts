import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import { mountEmbeddingRuntimeService } from "./runtime-service.ts";
import type { AfterEmbeddingStoredFn } from "./runtime-service.ts";
import type { EmbedTextFn, EmbedTextsFn } from "./types.ts";

export type { AfterEmbeddingStoredFn };

export function registerEmbedTextFn(fn: EmbedTextFn | null): void {
  mountEmbeddingRuntimeService(ensureProcessContext()).setEmbedTextFn(fn);
}

export function getEmbedTextFn(): EmbedTextFn | null {
  return getProcessContext()?.embeddingRuntime?.getEmbedTextFn() ?? null;
}

export function registerEmbedTextsFn(fn: EmbedTextsFn | null): void {
  mountEmbeddingRuntimeService(ensureProcessContext()).setEmbedTextsFn(fn);
}

export function getEmbedTextsFn(): EmbedTextsFn | null {
  return getProcessContext()?.embeddingRuntime?.getEmbedTextsFn() ?? null;
}

export function registerAfterEmbeddingStored(fn: AfterEmbeddingStoredFn | null): void {
  mountEmbeddingRuntimeService(ensureProcessContext()).setAfterEmbeddingStored(fn);
}

export function getAfterEmbeddingStored(): AfterEmbeddingStoredFn | null {
  return getProcessContext()?.embeddingRuntime?.getAfterEmbeddingStored() ?? null;
}

/** Test teardown */
export function resetEmbedTextFnForTest(): void {
  getProcessContext()?.embeddingRuntime?.setEmbedTextFn(null);
}

export function resetEmbedTextsFnForTest(): void {
  getProcessContext()?.embeddingRuntime?.setEmbedTextsFn(null);
}

export function resetAfterEmbeddingStoredForTest(): void {
  getProcessContext()?.embeddingRuntime?.setAfterEmbeddingStored(null);
}
