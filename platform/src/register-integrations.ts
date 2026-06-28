import { createFridgeMagnetHandler } from "@freeanima/capabilities-task/fridge-magnet";
import { createNotificationInjectHandler } from "@freeanima/capabilities-tools/notification";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { registerClarifyHooks } from "@freeanima/capabilities-tools/clarify";
import { createAcpProgressDelivery } from "./acp-progress-delivery.ts";
import { createAcpTaskQueryPort } from "./acp-task-query.ts";
import type { Kernel } from "@freeanima/kernel";
import type { Config } from "@freeanima/core/config";
import { beforeLlmCall } from "@freeanima/core/hooks/loop";
import type { ConversationService } from "@freeanima/runtime/conversation";
import type { SkillRegistry } from "@freeanima/core/skill";
import type { ToolSetRegistry } from "@freeanima/core/tool";

/** Register clarify hook and ACP tools (requires kernel + conversation) */
export function registerServiceIntegrations(opts: {
  kernel: Kernel;
  conversation: ConversationService;
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
  config: Config;
  onConversationUpdated?: ((sid: string) => void) | null;
}): void {
  registerClarifyHooks({
    kernel: opts.kernel,
    conversation: opts.conversation,
    config: opts.config,
  });
  const acp = getAcpManager();
  acp.wireRegistries({ toolSets: opts.toolSets, skills: opts.skills, config: opts.config });
  acp.wireConversation(opts.conversation);
  acp.wireTaskQuery(createAcpTaskQueryPort());
  acp.wireProgressDelivery(
    createAcpProgressDelivery({
      conversation: opts.conversation,
      bus: opts.kernel.eventBus,
      onConversationUpdated: opts.onConversationUpdated ?? null,
    }),
  );
  acp.registerTools();
}

/** Register fridge magnet beforeLlmCall hook (FridgeStore must be available after registerFridgeStore at composition root) */
export function registerFridgeMagnet(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createFridgeMagnetHandler());
}

/** Register unread notification inject beforeLlmCall hook (NotificationPort must be registered) */
export function registerNotificationInject(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createNotificationInjectHandler());
}

/** Start ACP progress polling after service startup */
export function startAcpProgressTicker(): void {
  getAcpManager().startProgressTicker();
}
