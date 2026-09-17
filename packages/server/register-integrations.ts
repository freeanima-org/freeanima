import { notificationInjectPlugin } from "@freeanima/capabilities/tools/notification";
import { registerMemoryPassiveRecallHook as registerPassiveRecall } from "@freeanima/capabilities/memory";
import { registerClarifyHooks } from "@freeanima/capabilities/tools/clarify";
import { createTemporalPeerInjectHandler } from "./service/temporal-summary-inject.ts";
import type { Kernel } from "@freeanima/kernel";
import type { Config } from "@freeanima/core/config";
import { onBeforeLlmCall } from "@freeanima/core/hooks/cordis";
import type { ConversationService } from "@freeanima/engine/conversation";
import type { SkillRegistry } from "@freeanima/core/skill";
import type { ToolSetRegistry } from "@freeanima/core/tool";

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

/** Mount unread-notification injector; waits for `ctx.notifications` via inject */
export function registerNotificationInject(opts: { kernel: Kernel }): void {
  opts.kernel.ctx.plugin(notificationInjectPlugin);
}

/** Register passive semantic memory recall beforeLlmCall hook */
export function registerMemoryPassiveRecallHook(opts: { kernel: Kernel }): void {
  registerPassiveRecall(opts);
}

/** Register temporal-summary peer timeline inject beforeLlmCall hook */
export function registerTemporalSummaryPeerInject(opts: { kernel: Kernel }): void {
  onBeforeLlmCall(opts.kernel.ctx, createTemporalPeerInjectHandler());
}
