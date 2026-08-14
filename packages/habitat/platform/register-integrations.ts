import { createNotificationInjectHandler } from "@freeanima/habitat/capabilities/tools/notification";
import { registerMemoryPassiveRecallHook as registerPassiveRecall } from "@freeanima/habitat/capabilities/memory";
import { registerClarifyHooks } from "@freeanima/habitat/capabilities/tools/clarify";
import { createTemporalPeerInjectHandler } from "./service/temporal-summary-inject.ts";
import type { Kernel } from "@freeanima/habitat/kernel";
import type { Config } from "@freeanima/habitat/core/config";
import { beforeLlmCall } from "@freeanima/habitat/core/hooks/loop";
import type { ConversationService } from "@freeanima/habitat/engine/conversation";
import type { SkillRegistry } from "@freeanima/habitat/core/skill";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

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
