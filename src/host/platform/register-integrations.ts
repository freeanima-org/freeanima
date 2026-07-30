import { createNotificationInjectHandler } from "@freeanima/host/capabilities/tools/notification";
import { registerMemoryPassiveRecallHook as registerPassiveRecall } from "@freeanima/host/capabilities/memory";
import { registerClarifyHooks } from "@freeanima/host/capabilities/tools/clarify";
import { createTemporalPeerInjectHandler } from "./service/temporal-summary-inject.ts";
import type { Kernel } from "@freeanima/host/kernel";
import type { Config } from "@freeanima/host/core/config";
import { beforeLlmCall } from "@freeanima/host/core/hooks/loop";
import type { ConversationService } from "@freeanima/host/engine/conversation";
import type { SkillRegistry } from "@freeanima/host/core/skill";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";

/** Register clarify hook (requires kernel + conversation) */
export function registerServiceIntegrations(opts: {
  kernel: Kernel;
  conversation: ConversationService;
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
  config: Config;
  onConversationUpdated?: ((sid: string) => void) | null;
}): void {
  void opts.toolSets;
  void opts.skills;
  void opts.onConversationUpdated;
  registerClarifyHooks({
    kernel: opts.kernel,
    conversation: opts.conversation,
    config: opts.config,
  });
}

/** Register unread notification inject beforeLlmCall hook (NotificationPort must be registered) */
export function registerNotificationInject(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createNotificationInjectHandler(), {
    llm_kind: "conversation",
  });
}

/** Register passive semantic memory recall beforeLlmCall hook */
export function registerMemoryPassiveRecallHook(opts: { kernel: Kernel }): void {
  registerPassiveRecall(opts);
}

/** Register temporal-summary peer timeline inject beforeLlmCall hook */
export function registerTemporalSummaryPeerInject(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createTemporalPeerInjectHandler(), {
    llm_kind: "conversation",
  });
}
