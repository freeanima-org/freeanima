import { isSessionMeta, resolveExecutableToolNames } from "@freeanima/runtime/conversation";
import { resolveSessionMaskFromMeta, runtimeToolMaskFromResolved } from "./mask-wire.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";
import type { SessionMessage as Message } from "@freeanima/core/db/domain";
import type { SessionMessage } from "@freeanima/core/db/domain";
import * as loopEngine from "@freeanima/runtime/loop";
import { runWithToolContext } from "@freeanima/core/tool";
import type { StreamEvent } from "@freeanima/runtime/loop";
import { applyClarifyStreamAwaiting } from "@freeanima/capabilities-tools/clarify";
import { ProviderError } from "@freeanima/core/provider";
import { getProfileHopModel } from "@freeanima/platform/config";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import { isInsufficientToolMessagesError } from "@freeanima/core/llm";
import type { HookRegistry } from "@freeanima/kernel/hooks";
import { SessionManager } from "./session-manager.ts";

/** beginTurn / retryTurn return value: [runtimeMsgs, functions, effectiveUserText] */
export type TurnPrepareResult = [SessionMessage[], string[], string];

export type StreamTurnHost = {
  runExclusive<T>(sessionId: string, fn: () => Promise<T>): Promise<T>;
  beginEngineRun(sessionId: string): { signal: AbortSignal; controller: AbortController };
  endEngineRun(sessionId: string, controller: AbortController): void;
  acquireInFlight(): void;
  releaseInFlight(): void;
  isShuttingDown?(): boolean;
  engineStreamOpts(
    sessionId: string,
    signal: AbortSignal,
  ): {
    hookRegistry: HookRegistry;
    onMessageAppended: (msg: SessionMessage) => Promise<void>;
    onToolRoundComplete: (batch: SessionMessage[]) => Promise<void>;
    signal: AbortSignal;
  };
  reloadRuntimeAfterRepair(sessionId: string): Promise<[Message[], string[]]>;
  onTurnAfterComplete(sessionId: string, msgs: Message[], reply: string): Promise<string>;
  emitSessionUpdated(sessionId: string): void;
};

export function streamErrorEvent(
  deps: FullRuntimeDeps,
  sessionId: string,
  message: string,
  err?: unknown,
): StreamEvent {
  const path = `/sessions/${sessionId}/messages/stream`;
  const attrs = { session_id: sessionId, path };
  deps.engine.logger.with({ component: "sse" }).error(`SSE ${path}: ${message}`, attrs);
  if (err !== undefined) {
    deps.engine.logger
      .with({ component: "anima-service" })
      .error(message, { err, session_id: sessionId });
  }
  return { event: "error", data: { error: message } };
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

/** Persist to session per-message or in batch during engine run */
export function createTurnMessageCallbacks(
  deps: FullRuntimeDeps,
  sessionId: string,
): {
  onMessageAppended: (msg: SessionMessage) => Promise<void>;
  onToolRoundComplete: (batch: SessionMessage[]) => Promise<void>;
} {
  return {
    onMessageAppended: async (msg) => {
      await deps.conversation.appendMessage(msg, sessionId);
    },
    onToolRoundComplete: async (batch) => {
      for (const msg of batch) {
        await deps.conversation.appendMessage(msg, sessionId);
      }
    },
  };
}

/** Shared by streaming / non-streaming: messages written in callbacks; finishTurn only updates meta */
export async function finalizeTurn(
  deps: FullRuntimeDeps,
  sessionId: string,
  msgs: SessionMessage[],
  effectiveUserText: string,
  model: string,
  functions?: string[],
): Promise<void> {
  await deps.conversation.finishTurn(sessionId, msgs, effectiveUserText, model, functions, true);
}

export type RunSimpleTurnOpts = {
  sessionId: string;
  prompt: string;
  model: string;
  /** Default conversation.beginTurn; pass conversation.retryTurn for retry etc. */
  prepare?: (sessionId: string, prompt: string) => Promise<TurnPrepareResult>;
};

/**
 * Non-streaming full turn: beginTurn → loopEngine.run → finishTurn.
 * Used by cron / scripts without SSE.
 */
export async function runSimpleTurn(
  deps: FullRuntimeDeps,
  opts: RunSimpleTurnOpts,
): Promise<string> {
  const { sessionId, prompt, model, prepare = deps.conversation.beginTurn } = opts;
  const [msgs, functions, effective] = await prepare(sessionId, prompt);
  const tools = await deps.conversation.loadSessionTools(sessionId);
  const meta = await deps.conversation.loadSessionMeta(sessionId);
  const toolMask = runtimeToolMaskFromResolved(resolveSessionMaskFromMeta(deps, meta));
  const executableTools = isSessionMeta(meta) ? resolveExecutableToolNames(meta) : undefined;
  try {
    return await runWithToolContext(
      sessionId,
      () =>
        loopEngine.run(msgs, {
          config: deps.engine.config.data,
          logger: deps.engine.logger,
          model,
          tools,
          llm: deps.engine.llm,
          toolMask,
          executableTools,
          ...createTurnMessageCallbacks(deps, sessionId),
        }),
      { repos: deps.conversation.repos, tools: deps.engine.catalog.toolSets, executableTools },
    );
  } catch (e) {
    if (e instanceof loopEngine.MaxTurnsExceeded) {
      return `[tool loop limit exceeded] ${e.message}`;
    }
    return `[engine error] ${e}`;
  } finally {
    await finalizeTurn(deps, sessionId, msgs, effective, model, functions);
  }
}

export async function* yieldEngineStream(
  deps: FullRuntimeDeps,
  host: Pick<StreamTurnHost, "acquireInFlight" | "releaseInFlight" | "engineStreamOpts">,
  sessionId: string,
  msgs: Message[],
  model: string,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const tools = await deps.conversation.loadSessionTools(sessionId);
  const meta = await deps.conversation.loadSessionMeta(sessionId);
  const toolMask = runtimeToolMaskFromResolved(resolveSessionMaskFromMeta(deps, meta));
  const executableTools = isSessionMeta(meta) ? resolveExecutableToolNames(meta) : undefined;
  host.acquireInFlight();
  try {
    try {
      for await (const ev of runWithToolContext(
        sessionId,
        () =>
          loopEngine.runStream(msgs, {
            model,
            tools,
            config: deps.engine.config.data,
            logger: deps.engine.logger,
            llm: deps.engine.llm,
            toolMask,
            executableTools,
            ...host.engineStreamOpts(sessionId, signal),
          }),
        { repos: deps.conversation.repos, tools: deps.engine.catalog.toolSets, executableTools },
      )) {
        if (ev.event === "awaiting_clarify") {
          await applyClarifyStreamAwaiting(
            deps.conversation,
            sessionId,
            ev.data.items,
            ev.data.timeout_sec,
          );
        }
        yield ev;
      }
    } catch (e) {
      if (e instanceof loopEngine.EngineTurnInterrupted) {
        yield { event: "interrupted", data: { reason: e.message } };
        yield { event: "done", data: { reason: "interrupted" } };
        return;
      }
      if (e instanceof loopEngine.MaxTurnsExceeded) {
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
};

export async function* runExclusiveStreamTurn(
  deps: FullRuntimeDeps,
  sessionId: string,
  prepareOpts: StreamTurnPrepareOpts | (() => Promise<[Message[], string[], string]>),
  host: StreamTurnHost,
  sessionManager: SessionManager,
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

  const work = sessionManager.runExclusive(sessionId, async () => {
    let msgs: Message[];
    let functions: string[];
    let effective: string;
    if (opts.fast) {
      effective = await opts.fast();
      buffer.push({ event: "accepted", data: {} });
      signalReady();
      const prepared = await opts.prepare();
      msgs = prepared[0];
      functions = prepared[1];
    } else {
      [msgs, functions, effective] = await opts.prepare();
    }
    const cfg = deps.engine.config.data;
    const model = getProfileHopModel(cfg, PROFILE_CHAT);
    let hadError = false;
    let sawDone = false;
    let retried = false;

    while (true) {
      if (host.isShuttingDown?.()) break;
      hadError = false;
      sawDone = false;
      let pendingDone: StreamEvent | null = null;
      let streamedText = false;
      const { signal, controller } = host.beginEngineRun(sessionId);

      try {
        for await (const ev of yieldEngineStream(deps, host, sessionId, msgs, model, signal)) {
          if (ev.event === "done") {
            pendingDone = ev;
            sawDone = true;
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
              const [runtimeMsgs, fn] = await host.reloadRuntimeAfterRepair(sessionId);
              msgs = runtimeMsgs;
              functions = fn;
              retried = true;
              hadError = false;
              break;
            }
          }
        }
        if (retried && !sawDone && !hadError) {
          if (host.isShuttingDown?.()) break;
          continue;
        }
        if (!hadError) {
          const reply = lastAssistantText(msgs);
          const displayContent = await host.onTurnAfterComplete(sessionId, msgs, reply);
          if (displayContent !== reply) {
            buffer.push({ event: "content_replace", data: { content: displayContent } });
            signalReady();
          } else if (displayContent.trim() && !streamedText) {
            buffer.push({ event: "content_replace", data: { content: displayContent } });
            signalReady();
          }
          if (pendingDone) {
            buffer.push(pendingDone);
            signalReady();
          } else if (!sawDone) {
            buffer.push({ event: "done", data: {} });
            signalReady();
          }
          await new Promise<void>((resolve) => setImmediate(resolve));
          await finalizeTurn(deps, sessionId, msgs, effective, model, functions);
        }
        break;
      } catch (e) {
        hadError = true;
        buffer.push(streamErrorEvent(deps, sessionId, String(e), e));
        signalReady();
        break;
      } finally {
        host.endEngineRun(sessionId, controller);
      }
    }

    if (!hadError) {
      host.emitSessionUpdated(sessionId);
    }
    closed = true;
    signalReady();
  });

  while (!closed || buffer.length > 0) {
    while (buffer.length > 0) {
      yield buffer.shift()!;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    if (closed) break;
    await new Promise<void>((resolve) => {
      wake = resolve;
      setTimeout(resolve, 50);
    });
  }

  await work;
}
