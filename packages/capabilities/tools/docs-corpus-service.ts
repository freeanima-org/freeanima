import { Service, type Context } from "cordis";

import type { DocsCorpus } from "./docs-corpus.ts";

declare module "cordis" {
  interface Context {
    docsCorpus: DocsCorpusService;
  }
}

/**
 * Cordis service (`ctx.docsCorpus`) holding the injected/cached docs corpus.
 * Replaces the module-level singletons in `tools/docs-corpus.ts`.
 */
export class DocsCorpusService extends Service {
  private injected: DocsCorpus | null = null;
  private cached: DocsCorpus | null = null;

  constructor(ctx: Context) {
    super(ctx, "docsCorpus");
  }

  getInjected(): DocsCorpus | null {
    return this.injected;
  }

  setInjected(corpus: DocsCorpus | null): void {
    this.injected = corpus;
    this.cached = null;
  }

  getCached(): DocsCorpus | null {
    return this.cached;
  }

  setCached(corpus: DocsCorpus | null): void {
    this.cached = corpus;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountDocsCorpusService(ctx: Context): DocsCorpusService {
  const existing = ctx.docsCorpus as DocsCorpusService | undefined;
  if (existing) return existing;
  return new DocsCorpusService(ctx);
}
