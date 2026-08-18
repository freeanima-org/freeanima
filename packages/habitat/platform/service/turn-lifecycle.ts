import {
  isConversationMeta,
  resolveExecutableToolNames,
} from "@freeanima/habitat/engine/conversation";
import type { FullRuntimeDeps } from "./runtime-deps.ts";
import {
  triggerConversationTitleIfFirstTurn,
  type SessionTitleNotify,
} from "./conversation-title.ts";
import type { StoredMessage as Message } from "@freeanima/habitat/core/db/domain";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import * as loopEngine from "@freeanima/habitat/kernel/loop-mechanism";
import { createConversationAfterMessagesPersisted } from "@freeanima/habitat/kernel/loop-mechanism";
import { runWithToolContext } from "@freeanima/habitat/core/tool";
import type { StreamEvent } from "@freeanima/habitat/kernel/loop-mechanism";
import { applyClarifyStreamAwaiting } from "@freeanima/habitat/capabilities/tools/clarify";
import { ProviderError } from "@freeanima/habitat/core/provider";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { getProfileHopModel } from "@freeanima/habitat/platform/config";
import { PROFILE_CHAT } from "@freeanima/habitat/core/provider";
import {
  isInsufficientToolMessagesError,
  REPAIR_REASON_INTERRUPT,
} from "@freeanima/habitat/core/llm";
import {
  evaluateGoalAfterTurn,
  shouldSkipGoalEvaluate,
  toGoalRuntimeDeps,
} from "@freeanima/habitat/engine/goal";
import type { HookRegistry } from "@freeanima/habitat/kernel/hooks";
import { ConversationManager } from "./conversation-manager.ts";
import { scheduleMemorySyncAfterTurn } from "./memory-sync-turn.ts";
import { scheduleSkillEvolveAfterTurn } from "./skill-review-run.ts";

/** beginTurn / retryTurn return value: [runtimeMsgs, functions, effectiveUserText] */
export type TurnPrepareResult = [StoredMessage[], string[], string];

export type StreamTurnHost = {
  runExclusive<T>(conversationId: string, fn: () => Promise<T>): Promise<T>;
  beginEngineRun(conversationId: string): { signal: AbortSignal; controller: AbortController };
  endEngineRun(conversationId: string, controller: AbortController): void;
  acquireInFlight(): void;
  releaseInFlight(): void;
  isShuttingDown?(): boolean;
  engineStreamOpts(
    conversationId: string,
    signal: AbortSignal,
    llmDebug?: boolean,
  ): {
    hookRegistry: HookRegistry;
    llm_kind: "conversation";
    conversationId: string;
    toolProgress: true;
    onAfterMessagesPersisted: ReturnType<typeof createConversationAfterMessagesPersisted>;
    onMessageAppended: (msg: StoredMessage) => Promise<void>;
    onToolRoundComplete: (batch: StoredMessage[]) => Promise<void>;
    signal: AbortSignal;
    shouldStop?: () => boolean;
    llm_debug?: boolean;
  };
  reloadRuntimeAfterRepair(conversationId: string): Promise<[Message[], string[]]>;
  onTurnAfterComplete(conversationId: string, msgs: Message[], reply: string): Promise<string>;
  emitSessionUpdated(conversationId: string): void;
};

export function streamErrorEvent(
  deps: FullRuntimeDeps,
  conversationId: string,
  message: string,
  err?: unknown,
): StreamEvent {
  const path = `/conversations/${conversationId}/messages/stream`;
  const attrs = { conversation_id: conversationId, path };
  deps.engine.logger.with({ component: "sse" }).error(`SSE ${path}: ${message}`, attrs);
  if (err !== undefined) {
    deps.engine.logger
      .with({ component: "anima-service" })
      .error(message, { err, conversation_id: conversationId });
  }
  return { event: "error", data: { error: message } };
}

function pushInterrupted(buffer: StreamEvent[], signalReady: () => void, reason: string): void {
  buffer.push({ event: "interrupted", data: { reason } });
  buffer.push({ event: "done", data: { reason: "interrupted" } });
  signalReady();
}

export function lastAssistantText(msgs: Message[]): string {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "assistant") {
      const content = m.content;
      return typeof content === "string" ? content : "";
    }
  }
  return "";
}

/** Persist to conversation per-message or in batch during engine run */
export function createTurnMessageCallbacks(
  deps: FullRuntimeDeps,
  conversationId: string,
): {
  onMessageAppended: (msg: StoredMessage) => Promise<void>;
  onToolRoundComplete: (batch: StoredMessage[]) => Promise<void>;
} {
  return {
    onMessageAppended: async (msg) => {
      await deps.conversation.appendMessage(msg, conversationId);
    },
    onToolRoundComplete: async (batch) => {
      for (const msg of batch) {
        await deps.conversation.appendMessage(msg, conversationId);
      }
    },
  };
}

/** Shared by streaming / non-streaming: messages written in callbacks; finishTurn only updates meta */
export async function finalizeTurn(
  deps: FullRuntimeDeps,
  conversationId: string,
  msgs: StoredMessage[],
  effectiveUserText: string,
  model: string,
  functions?: string[],
): Promise<void> {
  await deps.conversation.finishTurn(
    conversationId,
    msgs,
    effectiveUserText,
    model,
    functions,
    true,
  );
}

export type RunSimpleTurnOpts = {
  conversationId: string;
  prompt: string;
  model: string;
  /** Default conversation.beginTurn; pass conversation.retryTurn for retry etc. */
  prepare?: (conversationId: string, prompt: string) => Promise<TurnPrepareResult>;
  /** Optional conversation.updated notification after async title generation */
  titleNotify?: SessionTitleNotify;
};

/**
 * Non-streaming full turn: beginTurn → loopEngine.run → finishTurn.
 * Used by cron / scripts without SSE.
 */
export async function runSimpleTurn(
  deps: FullRuntimeDeps,
  opts: RunSimpleTurnOpts,
): Promise<string> {
  const {
    conversationId,
    prompt,
    model,
    prepare = deps.conversation.beginTurn,
    titleNotify,
  } = opts;
  let [msgs, functions, effective] = await prepare(conversationId, prompt);
  await triggerConversationTitleIfFirstTurn(deps, conversationId, effective, titleNotify);
  const goalDeps = toGoalRuntimeDeps(deps);
  let result = "";

  goalLoop: while (true) {
    const tools = await deps.conversation.loadConversationTools(conversationId);
    const meta = await deps.conversation.loadConversationMeta(conversationId);
    const executableTools = isConversationMeta(meta)
      ? resolveExecutableToolNames(meta, deps.engine.catalog.toolSets)
      : undefined;
    try {
      result = await runWithToolContext(
        conversationId,
        () =>
          loopEngine.run(msgs, {
            logger: deps.engine.logger,
            model,
            tools,
            llm: deps.engine.llm,
            conversationId,
            toolProgress: true,
            onAfterMessagesPersisted: createConversationAfterMessagesPersisted(conversationId),
            ...omitUndefined({ executableTools }),
            hookRegistry: deps.kernel.hookRegistry,
            llm_kind: "conversation",
            ...createTurnMessageCallbacks(deps, conversationId),
          }),
        { tools: deps.engine.catalog.toolSets, ...omitUndefined({ executableTools }) },
      );
    } catch (e) {
      if (e instanceof loopEngine.MaxLoopIterationsExceeded) {
        return `[tool loop limit exceeded] ${e.message}`;
      }
      return `[engine error] ${e instanceof Error ? e.message : String(e)}`;
    }
    await finalizeTurn(deps, conversationId, msgs, effective, model, functions);

    scheduleSkillEvolveAfterTurn(deps, conversationId, msgs);
    scheduleMemorySyncAfterTurn(conversationId, msgs);

    if (await shouldSkipGoalEvaluate(goalDeps, conversationId, msgs)) {
      break goalLoop;
    }
    const evalResult = await evaluateGoalAfterTurn(goalDeps, conversationId, msgs);
    if (evalResult.action !== "continue") {
      if (evalResult.displayHint) {
        await deps.conversation.appendMessage?.(
          { role: "assistant", content: evalResult.displayHint },
          conversationId,
        );
      }
      break goalLoop;
    }
    effective = await deps.conversation.beginTurnFast(conversationId, evalResult.continuePrompt);
    const prepared = await deps.conversation.beginTurnPrepare(conversationId);
    msgs = prepared[0];
    functions = prepared[1];
  }

  return result;
}

export async function* yieldEngineStream(
  deps: FullRuntimeDeps,
  host: Pick<StreamTurnHost, "acquireInFlight" | "releaseInFlight" | "engineStreamOpts">,
  conversationId: string,
  msgs: Message[],
  model: string,
  signal: AbortSignal,
  llmDebug?: boolean,
): AsyncGenerator<StreamEvent> {
  const tools = await deps.conversation.loadConversationTools(conversationId);
  const meta = await deps.conversation.loadConversationMeta(conversationId);
  const executableTools = isConversationMeta(meta)
    ? resolveExecutableToolNames(meta, deps.engine.catalog.toolSets)
    : undefined;
  host.acquireInFlight();
  try {
    try {
      for await (const ev of runWithToolContext(
        conversationId,
        () =>
          loopEngine.runStream(msgs, {
            model,
            tools,
            logger: deps.engine.logger,
            llm: deps.engine.llm,
            ...omitUndefined({ executableTools, llm_debug: llmDebug ? true : undefined }),
            ...host.engineStreamOpts(conversationId, signal, llmDebug),
          }),
        { tools: deps.engine.catalog.toolSets, ...omitUndefined({ executableTools }) },
      )) {
        if (ev.event === "awaiting_clarify") {
          await applyClarifyStreamAwaiting(
            deps.conversation,
            conversationId,
            ev.data.items.map((item) => omitUndefined(item)),
            ev.data.timeout_sec,
          );
        }
        yield ev;
      }
    } catch (e) {
      if (e instanceof loopEngine.EngineLoopInterrupted) {
        yield { event: "interrupted", data: { reason: e.message } };
        yield { event: "done", data: { reason: "interrupted" } };
        return;
      }
      if (e instanceof loopEngine.MaxLoopIterationsExceeded) {
        const msg = `tool loop exceeded: ${e.message}`;
        deps.engine.logger.with({ component: "anima-service" }).error(msg, { err: e });
        yield { event: "error", data: { error: msg } };
        return;
      }
      if (e instanceof ProviderError) {
        deps.engine.logger.with({ component: "anima-service" }).error(e.message, { err: e });
        yield { event: "error", data: { error: e.message } };
        return;
      }
      const msg = String(e);
      deps.engine.logger.with({ component: "anima-service" }).error(msg, { err: e });
      yield { event: "error", data: { error: msg } };
    }
  } finally {
    host.releaseInFlight();
  }
}

export type StreamTurnPrepareOpts = {
  /** 快路径：append 用户消息后 yield accepted */
  fast?: () => Promise<string>;
  prepare: () => Promise<[Message[], string[], string]>;
  llmDebug?: boolean;
};

export async function* runExclusiveStreamTurn(
  deps: FullRuntimeDeps,
  conversationId: string,
  prepareOpts: StreamTurnPrepareOpts | (() => Promise<[Message[], string[], string]>),
  host: StreamTurnHost,
  conversationManager: ConversationManager,
): AsyncGenerator<StreamEvent> {
  const opts: StreamTurnPrepareOpts =
    typeof prepareOpts === "function" ? { prepare: prepareOpts } : prepareOpts;
  const buffer: StreamEvent[] = [];
  let closed = false;
  let wake: (() => void) | null = null;
  const signalReady = () => {
    wake?.();
    wake = null;
  };

  const work = conversationManager.runExclusive(conversationId, async () => {
    const { signal, controller } = host.beginEngineRun(conversationId);
    let hadError = false;
    try {
      if (signal.aborted) {
        pushInterrupted(buffer, signalReady, REPAIR_REASON_INTERRUPT);
        return;
      }

      let msgs: Message[];
      let functions: string[];
      let effective: string;
      if (opts.fast) {
        effective = await opts.fast();
        if (signal.aborted) {
          pushInterrupted(buffer, signalReady, REPAIR_REASON_INTERRUPT);
          return;
        }
        buffer.push({ event: "accepted", data: {} });
        signalReady();
        const prepared = await opts.prepare();
        if (signal.aborted) {
          pushInterrupted(buffer, signalReady, REPAIR_REASON_INTERRUPT);
          return;
        }
        msgs = prepared[0];
        functions = prepared[1];
      } else {
        [msgs, functions, effective] = await opts.prepare();
        if (signal.aborted) {
          pushInterrupted(buffer, signalReady, REPAIR_REASON_INTERRUPT);
          return;
        }
      }
      const cfg = deps.engine.config.data;
      const model = getProfileHopModel(cfg, PROFILE_CHAT);
      const goalDeps = toGoalRuntimeDeps(deps);
      let sawDone = false;
      let retried = false;

      goalLoop: while (true) {
        if (host.isShuttingDown?.()) break goalLoop;
        if (signal.aborted) {
          pushInterrupted(buffer, signalReady, REPAIR_REASON_INTERRUPT);
          break goalLoop;
        }
        hadError = false;
        sawDone = false;
        let pendingDone: StreamEvent | null = null;
        let streamedText = false;
        let sawInterrupted = false;

        try {
          engineRetry: while (true) {
            if (host.isShuttingDown?.()) break engineRetry;
            if (signal.aborted) {
              pushInterrupted(buffer, signalReady, REPAIR_REASON_INTERRUPT);
              break goalLoop;
            }
            hadError = false;
            sawDone = false;
            pendingDone = null;
            streamedText = false;
            sawInterrupted = false;

            for await (const ev of yieldEngineStream(
              deps,
              host,
              conversationId,
              msgs,
              model,
              signal,
              opts.llmDebug,
            )) {
              if (ev.event === "interrupted") {
                sawInterrupted = true;
                buffer.push(ev);
                signalReady();
                continue;
              }
              if (ev.event === "done") {
                if (sawInterrupted) {
                  buffer.push(ev);
                  signalReady();
                } else {
                  pendingDone = ev;
                  sawDone = true;
                }
                continue;
              }
              if (ev.event === "token" || ev.event === "content_replace") {
                streamedText = true;
              }
              buffer.push(ev);
              signalReady();
              if (ev.event === "error") {
                hadError = true;
                if (!retried && isInsufficientToolMessagesError(ev.data.error)) {
                  const [runtimeMsgs, fn] = await host.reloadRuntimeAfterRepair(conversationId);
                  msgs = runtimeMsgs;
                  functions = fn;
                  retried = true;
                  hadError = false;
                  break;
                }
              }
            }
            if (sawInterrupted) {
              break goalLoop;
            }
            if (retried && !sawDone && !hadError) {
              if (host.isShuttingDown?.()) break engineRetry;
              continue;
            }
            break engineRetry;
          }

          if (!hadError) {
            if (signal.aborted) {
              pushInterrupted(buffer, signalReady, REPAIR_REASON_INTERRUPT);
              break goalLoop;
            }
            const reply = lastAssistantText(msgs);
            const displayContent = await host.onTurnAfterComplete(conversationId, msgs, reply);
            if (displayContent !== reply) {
              buffer.push({ event: "content_replace", data: { content: displayContent } });
              signalReady();
            } else if (displayContent.trim() && !streamedText) {
              buffer.push({ event: "content_replace", data: { content: displayContent } });
              signalReady();
            }
            await new Promise<void>((resolve) => {
              setImmediate(resolve);
            });
            await finalizeTurn(deps, conversationId, msgs, effective, model, functions);

            scheduleSkillEvolveAfterTurn(deps, conversationId, msgs);
            scheduleMemorySyncAfterTurn(conversationId, msgs);

            let evalResult: Awaited<ReturnType<typeof evaluateGoalAfterTurn>> | undefined;
            if (!(await shouldSkipGoalEvaluate(goalDeps, conversationId, msgs))) {
              evalResult = await evaluateGoalAfterTurn(goalDeps, conversationId, msgs);
            }

            // 终态提示须在 done 之前落库+推流，否则 UI 在 done 后清空 stream / reload 会丢提示
            if (evalResult?.displayHint && evalResult.action !== "continue") {
              await deps.conversation.appendMessage?.(
                { role: "assistant", content: evalResult.displayHint },
                conversationId,
              );
              buffer.push({ event: "token", data: { content: `\n${evalResult.displayHint}\n` } });
              signalReady();
            }

            if (pendingDone) {
              buffer.push(pendingDone);
              signalReady();
            } else if (!sawDone) {
              buffer.push({ event: "done", data: {} });
              signalReady();
            }

            if (evalResult?.action === "continue") {
              if (evalResult.displayHint) {
                buffer.push({ event: "token", data: { content: `\n${evalResult.displayHint}\n` } });
                signalReady();
              }
              effective = await deps.conversation.beginTurnFast(
                conversationId,
                evalResult.continuePrompt,
              );
              if (signal.aborted) {
                pushInterrupted(buffer, signalReady, REPAIR_REASON_INTERRUPT);
                break goalLoop;
              }
              const prepared = await deps.conversation.beginTurnPrepare(conversationId);
              if (signal.aborted) {
                pushInterrupted(buffer, signalReady, REPAIR_REASON_INTERRUPT);
                break goalLoop;
              }
              msgs = prepared[0];
              functions = prepared[1];
              retried = false;
              continue goalLoop;
            }
          }
          break goalLoop;
        } catch (e) {
          if (e instanceof loopEngine.EngineLoopInterrupted || signal.aborted) {
            pushInterrupted(
              buffer,
              signalReady,
              e instanceof loopEngine.EngineLoopInterrupted ? e.message : REPAIR_REASON_INTERRUPT,
            );
            break goalLoop;
          }
          hadError = true;
          buffer.push(streamErrorEvent(deps, conversationId, String(e), e));
          signalReady();
          break goalLoop;
        }
      }

      if (!hadError && !signal.aborted) {
        host.emitSessionUpdated(conversationId);
      }
    } finally {
      host.endEngineRun(conversationId, controller);
      closed = true;
      signalReady();
    }
  });

  while (true) {
    while (buffer.length > 0) {
      const event = buffer.shift();
      if (event === undefined) break;
      yield event;
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    }
    if (closed) break;
    await new Promise<void>((resolve) => {
      wake = resolve;
      setTimeout(resolve, 50);
    });
  }

  await work;
}
