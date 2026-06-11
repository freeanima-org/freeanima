import { createFridgeMagnetHandler } from "@freeanima/capabilities-fridge-magnet";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { registerClarifyHooks } from "@freeanima/capabilities-clarify";
import { createAcpProgressDelivery } from "./acp-progress-delivery.ts";
import { createAcpTaskQueryPort } from "./acp-task-query.ts";
import type { Kernel } from "@freeanima/kernel";
import type { Config } from "@freeanima/engine-config";
import { beforeLlmCall } from "@freeanima/engine-hooks/loop";
import type { ConversationService } from "@freeanima/engine-conversation";
import type { SkillRegistry } from "@freeanima/engine-skill";
import type { ToolSetRegistry } from "@freeanima/engine-tool";

/** Register clarify hook and ACP tools (requires kernel + conversation) */
export function registerServiceIntegrations(opts: {
  kernel: Kernel;
  conversation: ConversationService;
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
  config: Config;
  onSessionUpdated?: ((sid: string) => void) | null;
}): void {
  registerClarifyHooks({
    kernel: opts.kernel,
    conversation: opts.conversation,
    config: opts.config,
  });
  const acp = getAcpManager();
  acp.wireRegistries({ toolSets: opts.toolSets, skills: opts.skills, config: opts.config });
  acp.wireConversation(opts.conversation);
  acp.wireTaskQuery(createAcpTaskQueryPort(opts.conversation));
  acp.wireProgressDelivery(
    createAcpProgressDelivery({
      conversation: opts.conversation,
      bus: opts.kernel.eventBus,
      onSessionUpdated: opts.onSessionUpdated ?? null,
    }),
  );
  acp.registerTools();
}

/** Register fridge magnet beforeLlmCall hook (FridgeStore must be available after registerFridgeStore at composition root) */
export function registerFridgeMagnet(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createFridgeMagnetHandler());
}

/** Start ACP progress polling after service startup */
export function startAcpProgressTicker(): void {
  getAcpManager().startProgressTicker();
}
