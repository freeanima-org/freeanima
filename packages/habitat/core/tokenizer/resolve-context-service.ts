import { Service, type Context } from "cordis";
import type { ResolveContext } from "./resolve-context.ts";

declare module "cordis" {
  interface Context {
    tokenizerResolveContext: TokenizerResolveContextService;
  }
}

/**
 * Cordis service (`ctx.tokenizerResolveContext`) holding the tokenizer
 * resolution context bound by `bindTokenizerRuntime`. Replaces the module-level
 * singleton in `tokenizer/resolve-context.ts`.
 */
export class TokenizerResolveContextService extends Service {
  private context: ResolveContext = {};

  constructor(ctx: Context) {
    super(ctx, "tokenizerResolveContext");
  }

  set(next: ResolveContext): void {
    this.context = { ...next };
  }

  get(): ResolveContext {
    return this.context;
  }

  reset(): void {
    this.context = {};
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountTokenizerResolveContextService(ctx: Context): TokenizerResolveContextService {
  const existing = ctx.tokenizerResolveContext as TokenizerResolveContextService | undefined;
  if (existing) return existing;
  return new TokenizerResolveContextService(ctx);
}
