import { createFridgeMagnetHandler } from "@freeanima/capabilities-fridge-magnet";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { registerClarifyHooks } from "@freeanima/capabilities-clarify";
import { createAcpProgressDelivery } from "./acp-progress-delivery.ts";
import type { Kernel } from "@freeanima/kernel";
import { beforeLlmCall } from "@freeanima/engine-loop-hooks";
import type { ConversationService } from "@freeanima/engine-conversation";
import type { SkillRegistry } from "@freeanima/engine-skill";
import type { ToolSetRegistry } from "@freeanima/engine-tool";

/** Register clarify hook and ACP tools (requires kernel + conversation) */
export function registerServiceIntegrations(opts: {
  kernel: Kernel;
  conversation: ConversationService;
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
  onSessionUpdated?: ((sid: string) => void) | null;
}): void {
  registerClarifyHooks({ kernel: opts.kernel, conversation: opts.conversation });
  const acp = getAcpManager();
  acp.wireRegistries({ toolSets: opts.toolSets, skills: opts.skills });
  acp.wireConversation(opts.conversation);
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
