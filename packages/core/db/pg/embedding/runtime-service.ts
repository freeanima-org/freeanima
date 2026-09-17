import { Service, type Context } from "cordis";

import type { EmbedTextFn, EmbedTextsFn, EmbeddingJobKind } from "./types.ts";

export type AfterEmbeddingStoredFn = (info: {
  kind: EmbeddingJobKind;
  id: string;
  embedding: number[];
}) => void | Promise<void>;

declare module "cordis" {
  interface Context {
    embeddingRuntime: EmbeddingRuntimeService;
  }
}

/**
 * Cordis service (`ctx.embeddingRuntime`) holding the embedding function
 * bindings. Replaces the module-level singletons in `embedding/runtime.ts`.
 */
export class EmbeddingRuntimeService extends Service {
  private embedTextFn: EmbedTextFn | null = null;
  private embedTextsFn: EmbedTextsFn | null = null;
  private afterEmbeddingStoredFn: AfterEmbeddingStoredFn | null = null;

  constructor(ctx: Context) {
    super(ctx, "embeddingRuntime");
  }

  setEmbedTextFn(fn: EmbedTextFn | null): void {
    this.embedTextFn = fn;
  }

  getEmbedTextFn(): EmbedTextFn | null {
    return this.embedTextFn;
  }

  setEmbedTextsFn(fn: EmbedTextsFn | null): void {
    this.embedTextsFn = fn;
  }

  getEmbedTextsFn(): EmbedTextsFn | null {
    return this.embedTextsFn;
  }

  setAfterEmbeddingStored(fn: AfterEmbeddingStoredFn | null): void {
    this.afterEmbeddingStoredFn = fn;
  }

  getAfterEmbeddingStored(): AfterEmbeddingStoredFn | null {
    return this.afterEmbeddingStoredFn;
  }

  reset(): void {
    this.embedTextFn = null;
    this.embedTextsFn = null;
    this.afterEmbeddingStoredFn = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountEmbeddingRuntimeService(ctx: Context): EmbeddingRuntimeService {
  const existing = ctx.embeddingRuntime as EmbeddingRuntimeService | undefined;
  if (existing) return existing;
  return new EmbeddingRuntimeService(ctx);
}
