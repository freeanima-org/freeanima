import { Service, type Context } from "cordis";
import type { CompressionSummaryPostCut } from "./compression-summary-scheduler.ts";

declare module "cordis" {
  interface Context {
    compressionSummaryPostCut: CompressionSummaryPostCutService;
  }
}

/**
 * Cordis service (`ctx.compressionSummaryPostCut`) holding the post-cut rebuild
 * hook registered by the engine port binding. Replaces the module-level
 * singleton in `compress/compression-summary-scheduler.ts`.
 */
export class CompressionSummaryPostCutService extends Service {
  private fn: CompressionSummaryPostCut | null = null;

  constructor(ctx: Context) {
    super(ctx, "compressionSummaryPostCut");
  }

  bind(fn: CompressionSummaryPostCut): void {
    this.fn = fn;
  }

  get(): CompressionSummaryPostCut | null {
    return this.fn;
  }

  reset(): void {
    this.fn = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountCompressionSummaryPostCutService(
  ctx: Context,
): CompressionSummaryPostCutService {
  const existing = ctx.compressionSummaryPostCut as CompressionSummaryPostCutService | undefined;
  if (existing) return existing;
  return new CompressionSummaryPostCutService(ctx);
}
