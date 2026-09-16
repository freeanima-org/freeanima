import { Service, type Context } from "cordis";
import type { ConversationToolPolicyFilter } from "./policy-port.ts";

declare module "cordis" {
  interface Context {
    toolPolicy: ToolPolicyService;
  }
}

export type ToolPolicyServiceConfig = {
  filter: ConversationToolPolicyFilter;
};

/** Cordis service exposing the conversation tool policy filter as `ctx.toolPolicy`. */
export class ToolPolicyService extends Service {
  private filter: ConversationToolPolicyFilter;

  constructor(ctx: Context, config: ToolPolicyServiceConfig) {
    super(ctx, "toolPolicy");
    this.filter = config.filter;
  }

  apply(toolNames: string[], meta: Parameters<ConversationToolPolicyFilter>[1]): string[] {
    return this.filter(toolNames, meta);
  }

  setFilter(filter: ConversationToolPolicyFilter): void {
    this.filter = filter;
  }
}

/**
 * Mount synchronously (idempotent: re-mounting reuses the instance and swaps
 * the filter). Mount order is explicit in boot; tests mount in-process.
 */
export function mountToolPolicyService(
  ctx: Context,
  filter: ConversationToolPolicyFilter,
): ToolPolicyService {
  const existing = ctx.toolPolicy as ToolPolicyService | undefined;
  if (existing) {
    existing.setFilter(filter);
    return existing;
  }
  return new ToolPolicyService(ctx, { filter });
}
