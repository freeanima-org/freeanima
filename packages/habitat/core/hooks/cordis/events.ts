import type {
  MessageIncomingContext,
  MessageIncomingEffect,
  TurnAfterCompleteContext,
  TurnAfterCompleteEffect,
} from "../conversation/hooks.ts";
import type {
  BeforeLlmCallContext,
  ToolAfterCallContext,
  ToolAfterCallEffect,
} from "../loop/hooks.ts";
import type { SystemPromptBuildContext, SystemPromptBuildEffect } from "../prompt/hooks.ts";

/** Cordis event names for every harness hook. */
export const HOOK_EVENTS = {
  systemPromptBuild: "freeanima/system-prompt-build",
  beforeLlmCall: "freeanima/before-llm-call",
  toolAfterCall: "freeanima/tool-after-call",
  messageIncoming: "freeanima/message-incoming",
  turnAfterComplete: "freeanima/turn-after-complete",
  conversationUpdated: "freeanima/conversation-updated",
} as const;

/**
 * Single outcome for `messageIncoming`: the old `HookStepResult` split veto
 * (`blocked`) from effect data; here they live in one object.
 */
export type MessageIncomingOutcome = MessageIncomingEffect & { blocked?: string };

export type ToolAfterCallOutcome = ToolAfterCallEffect;

export type TurnAfterCompleteOutcome = TurnAfterCompleteEffect;

export type ConversationUpdatedPayload = {
  conversation_id: string;
};

declare module "cordis" {
  interface Events {
    /**
     * Waterfall accumulation. Each listener returns its own effect followed by
     * downstream effects, preserving the original oldest-first chain order.
     */
    "freeanima/system-prompt-build"(
      ctx: SystemPromptBuildContext,
      next: () => Promise<SystemPromptBuildEffect[]>,
    ): Promise<SystemPromptBuildEffect[]>;
    "freeanima/before-llm-call"(ctx: BeforeLlmCallContext): void | Promise<void>;
    /** Last-registered effect wins, matching the old `headOkStepData` read. */
    "freeanima/tool-after-call"(
      ctx: ToolAfterCallContext,
      next: () => Promise<ToolAfterCallOutcome>,
    ): Promise<ToolAfterCallOutcome>;
    /** Return `blocked` without calling `next()` to veto the incoming message. */
    "freeanima/message-incoming"(
      ctx: MessageIncomingContext,
      next: () => Promise<MessageIncomingOutcome>,
    ): Promise<MessageIncomingOutcome>;
    "freeanima/turn-after-complete"(
      ctx: TurnAfterCompleteContext,
      next: () => Promise<TurnAfterCompleteOutcome>,
    ): Promise<TurnAfterCompleteOutcome>;
    "freeanima/conversation-updated"(payload: ConversationUpdatedPayload): void;
  }
}
