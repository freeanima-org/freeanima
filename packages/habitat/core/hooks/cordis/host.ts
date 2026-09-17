import { Context } from "cordis";
import type { Logger } from "@freeanima/kernel/logging";
import type { MessageIncomingContext, TurnAfterCompleteContext } from "../conversation/hooks.ts";
import type { BeforeLlmCallContext, ToolAfterCallContext } from "../loop/hooks.ts";
import type { SystemPromptBuildContext, SystemPromptBuildEffect } from "../prompt/hooks.ts";
import {
  HOOK_EVENTS,
  type ConversationUpdatedPayload,
  type MessageIncomingOutcome,
  type ToolAfterCallOutcome,
  type TurnAfterCompleteOutcome,
} from "./events.ts";

export type HookLogger = Pick<Logger, "error">;

export type SystemPromptBuildHandler = (
  ctx: SystemPromptBuildContext,
) => SystemPromptBuildEffect | void | Promise<SystemPromptBuildEffect | void>;

export type BeforeLlmCallHandler = (ctx: BeforeLlmCallContext) => void | Promise<void>;

export type ToolAfterCallHandler = (
  ctx: ToolAfterCallContext,
) => ToolAfterCallOutcome | void | Promise<ToolAfterCallOutcome | void>;

export type MessageIncomingHandler = (
  ctx: MessageIncomingContext,
) => MessageIncomingOutcome | void | Promise<MessageIncomingOutcome | void>;

export type TurnAfterCompleteHandler = (
  ctx: TurnAfterCompleteContext,
) => TurnAfterCompleteOutcome | void | Promise<TurnAfterCompleteOutcome | void>;

export type ConversationUpdatedHandler = (payload: ConversationUpdatedPayload) => void;

const loggers = new WeakMap<Context, HookLogger>();

/** Create the root Cordis context that owns all harness hook listeners. */
export function createHookContext(logger?: HookLogger): Context {
  const ctx = new Context();
  if (logger) loggers.set(ctx, logger);
  return ctx;
}

/** Attach the runtime logger used to contain listener failures. */
export function setHookLogger(ctx: Context, logger: HookLogger): void {
  loggers.set(ctx, logger);
}

function logError(ctx: Context, event: string, err: unknown): void {
  const logger = loggers.get(ctx);
  logger?.error("hook listener failed", { event, err });
}

function definedOnly<T extends object>(value: T): T {
  const out = {} as Record<string, unknown>;
  for (const [key, v] of Object.entries(value)) {
    if (v !== undefined) out[key] = v;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- rebuild drops undefined keys
  return out as T;
}

// --- systemPromptBuild ---

export function onSystemPromptBuild(ctx: Context, handler: SystemPromptBuildHandler): () => void {
  const off = ctx.on(HOOK_EVENTS.systemPromptBuild, async (event, next) => {
    let mine: SystemPromptBuildEffect | void = undefined;
    try {
      mine = await handler(event);
    } catch (err) {
      logError(ctx, HOOK_EVENTS.systemPromptBuild, err);
    }
    const downstream = await next();
    if (mine?.sections?.length) return [mine, ...downstream];
    return downstream;
  });
  return () => {
    off();
  };
}

export async function runSystemPromptBuild(
  ctx: Context,
  payload: SystemPromptBuildContext,
): Promise<SystemPromptBuildEffect[]> {
  return ctx.waterfall(HOOK_EVENTS.systemPromptBuild, payload, async () => []);
}

// --- beforeLlmCall ---

export function onBeforeLlmCall(ctx: Context, handler: BeforeLlmCallHandler): () => void {
  const off = ctx.on(HOOK_EVENTS.beforeLlmCall, async (event) => {
    try {
      await handler(event);
    } catch (err) {
      logError(ctx, HOOK_EVENTS.beforeLlmCall, err);
    }
  });
  return () => {
    off();
  };
}

/** Listeners run sequentially in registration order; failures are contained. */
export async function runBeforeLlmCall(ctx: Context, payload: BeforeLlmCallContext): Promise<void> {
  await ctx.serial(HOOK_EVENTS.beforeLlmCall, payload);
}

// --- toolAfterCall ---

export function onToolAfterCall(ctx: Context, handler: ToolAfterCallHandler): () => void {
  const off = ctx.on(HOOK_EVENTS.toolAfterCall, async (event, next) => {
    let mine: ToolAfterCallOutcome | void = undefined;
    try {
      mine = await handler(event);
    } catch (err) {
      logError(ctx, HOOK_EVENTS.toolAfterCall, err);
    }
    const downstream = await next();
    return { ...definedOnly(mine ?? {}), ...definedOnly(downstream) };
  });
  return () => {
    off();
  };
}

export async function runToolAfterCall(
  ctx: Context,
  payload: ToolAfterCallContext,
): Promise<ToolAfterCallOutcome> {
  return ctx.waterfall(HOOK_EVENTS.toolAfterCall, payload, async () => ({}));
}

// --- messageIncoming ---

export function onMessageIncoming(ctx: Context, handler: MessageIncomingHandler): () => void {
  const off = ctx.on(HOOK_EVENTS.messageIncoming, async (event, next) => {
    let mine: MessageIncomingOutcome | void = undefined;
    try {
      mine = await handler(event);
    } catch (err) {
      logError(ctx, HOOK_EVENTS.messageIncoming, err);
    }
    const own = definedOnly(mine ?? {});
    if (own.blocked !== undefined) return own;
    const downstream = await next();
    return { ...own, ...definedOnly(downstream) };
  });
  return () => {
    off();
  };
}

export async function runMessageIncoming(
  ctx: Context,
  payload: MessageIncomingContext,
): Promise<MessageIncomingOutcome> {
  return ctx.waterfall(HOOK_EVENTS.messageIncoming, payload, async () => ({}));
}

// --- turnAfterComplete ---

export function onTurnAfterComplete(ctx: Context, handler: TurnAfterCompleteHandler): () => void {
  const off = ctx.on(HOOK_EVENTS.turnAfterComplete, async (event, next) => {
    let mine: TurnAfterCompleteOutcome | void = undefined;
    try {
      mine = await handler(event);
    } catch (err) {
      logError(ctx, HOOK_EVENTS.turnAfterComplete, err);
    }
    const downstream = await next();
    return { ...definedOnly(mine ?? {}), ...definedOnly(downstream) };
  });
  return () => {
    off();
  };
}

export async function runTurnAfterComplete(
  ctx: Context,
  payload: TurnAfterCompleteContext,
): Promise<TurnAfterCompleteOutcome> {
  return ctx.waterfall(HOOK_EVENTS.turnAfterComplete, payload, async () => ({}));
}

// --- conversationUpdated ---

export function onConversationUpdated(
  ctx: Context,
  handler: ConversationUpdatedHandler,
): () => void {
  const off = ctx.on(HOOK_EVENTS.conversationUpdated, (payload) => {
    try {
      handler(payload);
    } catch (err) {
      logError(ctx, HOOK_EVENTS.conversationUpdated, err);
    }
  });
  return () => {
    off();
  };
}

export function emitConversationUpdated(ctx: Context, payload: ConversationUpdatedPayload): void {
  ctx.emit(HOOK_EVENTS.conversationUpdated, payload);
}
