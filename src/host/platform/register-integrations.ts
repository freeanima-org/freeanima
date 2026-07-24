import { createNotificationInjectHandler } from "@freeanima/host/capabilities/tools/notification";
import { registerMemoryPassiveRecallHook as registerPassiveRecall } from "@freeanima/host/capabilities/memory";
import { getAcpManager } from "@freeanima/host/capabilities/acp";
import { registerClarifyHooks } from "@freeanima/host/capabilities/tools/clarify";
import { createAcpProgressDelivery } from "./acp-progress-delivery.ts";
import { createAcpTaskQueryPort } from "./acp-task-query.ts";
import { createTemporalPeerInjectHandler } from "./service/temporal-summary-inject.ts";
import type { Kernel } from "@freeanima/host/kernel";
import type { Config } from "@freeanima/host/core/config";
import { beforeLlmCall } from "@freeanima/host/core/hooks/loop";
import type { ConversationService } from "@freeanima/host/engine/conversation";
import type { SkillRegistry } from "@freeanima/host/core/skill";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";

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
  acp.bindRegistries({ toolSets: opts.toolSets, skills: opts.skills, config: opts.config });
  acp.bindConversation(opts.conversation);
  acp.bindTaskQuery(createAcpTaskQueryPort());
  acp.bindProgressDelivery(
    createAcpProgressDelivery({
      conversation: opts.conversation,
      bus: opts.kernel.eventBus,
      onConversationUpdated: opts.onConversationUpdated ?? null,
    }),
  );
  acp.registerTools();
}

/** Register unread notification inject beforeLlmCall hook (NotificationPort must be registered) */
export function registerNotificationInject(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createNotificationInjectHandler());
}

/** Register passive semantic memory recall beforeLlmCall hook */
export function registerMemoryPassiveRecallHook(opts: { kernel: Kernel }): void {
  registerPassiveRecall(opts);
}

/** Register temporal-summary peer timeline inject beforeLlmCall hook */
export function registerTemporalSummaryPeerInject(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createTemporalPeerInjectHandler());
}

/** Start ACP progress polling after service startup */
export function startAcpProgressTicker(): void {
  getAcpManager().startProgressTicker();
}
