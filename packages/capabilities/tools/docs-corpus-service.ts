import { Context, Service } from "cordis";

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

let current: DocsCorpusService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureDocsCorpusService(): DocsCorpusService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new DocsCorpusService(ownedCtx);
  }
  return current;
}

export function currentDocsCorpusService(): DocsCorpusService | null {
  return current;
}

/** Test teardown。 */
export function resetDocsCorpusServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
