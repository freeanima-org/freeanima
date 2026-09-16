import { Service, type Context } from "cordis";

import { toFeatureRpcHandlerMap } from "../habitat/route-handlers.ts";
import { getProcessContext } from "../service/process-context.ts";
import type { FeatureContribution, FeatureRpcHandler } from "./types.ts";

declare module "cordis" {
  interface Context {
    features: FeatureService;
  }
}

/**
 * Cordis service (`ctx.features`) collecting every feature plugin's Habitat
 * RPC handlers. Replaces the old module-level handler map so features become
 * mountable / disposable Cordis plugins.
 */
export class FeatureService extends Service {
  private readonly contributions = new Map<string, FeatureContribution>();
  private readonly handlers = new Map<string, FeatureRpcHandler>();

  constructor(ctx: Context) {
    super(ctx, "features");
  }

  provide(contribution: FeatureContribution): void {
    if (this.contributions.has(contribution.id)) {
      throw new Error(`duplicate feature contribution: ${contribution.id}`);
    }
    const rpc: Record<string, FeatureRpcHandler> = {};
    if (contribution.routes) {
      Object.assign(rpc, toFeatureRpcHandlerMap(contribution.routes.handlers));
    }
    if (contribution.rpc) {
      Object.assign(rpc, contribution.rpc);
    }
    for (const method of Object.keys(rpc)) {
      if (this.handlers.has(method)) {
        throw new Error(`duplicate feature RPC handler for ${method} (${contribution.id})`);
      }
    }
    for (const [method, handler] of Object.entries(rpc)) {
      this.handlers.set(method, handler);
    }
    this.contributions.set(contribution.id, contribution);
  }

  getHandler(method: string): FeatureRpcHandler | undefined {
    return this.handlers.get(method);
  }

  getContribution(id: string): FeatureContribution | undefined {
    return this.contributions.get(id);
  }

  listFeatureIds(): string[] {
    return [...this.contributions.keys()];
  }

  listHandledMethods(): string[] {
    return [...this.handlers.keys()];
  }

  clear(): void {
    this.contributions.clear();
    this.handlers.clear();
  }
}

function asFeatureService(value: unknown): FeatureService | undefined {
  return value instanceof FeatureService ? value : undefined;
}

/** The process-wide feature service, or `undefined` before it is mounted. */
export function getFeatureService(): FeatureService | undefined {
  const ctx = getProcessContext();
  if (!ctx) return undefined;
  return asFeatureService(ctx.reflect.get("features", false) as unknown);
}

/** Mount synchronously (idempotent: re-mounting reuses the instance). */
export function mountFeatureService(ctx: Context): FeatureService {
  const existing = asFeatureService(ctx.reflect.get("features", false) as unknown);
  if (existing) return existing;
  return new FeatureService(ctx);
}
