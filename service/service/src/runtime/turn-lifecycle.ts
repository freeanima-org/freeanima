import { getServiceContext } from "../context.ts";
import { resolveSessionMaskFromMeta, runtimeToolMaskFromResolved } from "./mask-wire.ts";

function conv() {
  return getServiceContext().conversation;
}
import type { SessionMessage as Message } from "@freeanima/engine-db/domain";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import * as engine from "@freeanima/engine-loop";
import { runWithToolContext } from "@freeanima/engine-loop";
import type { StreamEvent } from "@freeanima/engine-loop";
import { applyClarifyStreamAwaiting } from "@freeanima/capabilities-clarify";
import { ProviderError } from "@freeanima/engine-provider-llm";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import { logComponent, logSseError } from "@freeanima/service-logging";
import { isInsufficientToolMessagesError } from "@freeanima/engine-llm";
import type { HookRegistry } from "@freeanima/kernel-hooks";
import { SessionManager } from "./session-manager.ts";

/** beginTurn / retryTurn 返回值：[runtimeMsgs, functions, effectiveUserText] */
export type TurnPrepareResult = [SessionMessage[], string[], string];

export type StreamTurnHost = {
  runExclusive<T>(sessionId: string, fn: () => Promise<T>): Promise<T>;
  beginEngineRun(sessionId: string): { signal: AbortSignal; controller: AbortController };
  endEngineRun(sessionId: string, controller: AbortController): void;
  acquireInFlight(): void;
  releaseInFlight(): void;
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

export function streamErrorEvent(sessionId: string, message: string, err?: unknown): StreamEvent {
  logSseError(`/sessions/${sessionId}/messages/stream`, message, {
    session_id: sessionId,
  });
  if (err !== undefined) {
    logComponent("anima-service").error(message, { err, session_id: sessionId });
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

/** 引擎运行期间逐条 / 批量持久化到会话 */
export function createTurnMessageCallbacks(sessionId: string): {
  onMessageAppended: (msg: SessionMessage) => Promise<void>;
  onToolRoundComplete: (batch: SessionMessage[]) => Promise<void>;
} {
  return {
    onMessageAppended: async (msg) => {
      await conv().appendMessage(msg, sessionId);
    },
    onToolRoundComplete: async (batch) => {
      for (const msg of batch) {
        await conv().appendMessage(msg, sessionId);
      }
    },
  };
}

/** 流式 / 非流式共用：消息已在回调中写入，finishTurn 仅更新 meta */
export async function finalizeTurn(
  sessionId: string,
  msgs: SessionMessage[],
  effectiveUserText: string,
  model: string,
  functions?: string[],
): Promise<void> {
  await conv().finishTurn(sessionId, msgs, effectiveUserText, model, functions, true);
}

export type RunSimpleTurnOpts = {
  sessionId: string;
  prompt: string;
  model: string;
  /** 默认 conv().beginTurn；retry 等场景可传入 conv().retryTurn */
  prepare?: (sessionId: string, prompt: string) => Promise<TurnPrepareResult>;
};

/**
 * 非流式整轮：beginTurn → engine.run → finishTurn。
 * cron / 脚本等无 SSE 场景使用。
 */
export async function runSimpleTurn(opts: RunSimpleTurnOpts): Promise<string> {
  const { sessionId, prompt, model, prepare = conv().beginTurn } = opts;
  const [msgs, functions, effective] = await prepare(sessionId, prompt);
  const tools = await conv().loadSessionTools(sessionId);
  const meta = await conv().loadSessionMeta(sessionId);
  const toolMask = runtimeToolMaskFromResolved(resolveSessionMaskFromMeta(meta));
  try {
    return await runWithToolContext(
      sessionId,
      () =>
        engine.run(msgs, {
          model,
          tools,
          toolMask,
          ...createTurnMessageCallbacks(sessionId),
        }),
      { repos: conv().repos },
    );
  } catch (e) {
    if (e instanceof engine.MaxTurnsExceeded) {
      return `[工具循环超限] ${e.message}`;
    }
    return `[引擎错误] ${e}`;
  } finally {
    await finalizeTurn(sessionId, msgs, effective, model, functions);
  }
}

export async function* yieldEngineStream(
  host: Pick<StreamTurnHost, "acquireInFlight" | "releaseInFlight" | "engineStreamOpts">,
  sessionId: string,
  msgs: Message[],
  model: string,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const tools = await conv().loadSessionTools(sessionId);
  const meta = await conv().loadSessionMeta(sessionId);
  const toolMask = runtimeToolMaskFromResolved(resolveSessionMaskFromMeta(meta));
  host.acquireInFlight();
  try {
    try {
      for await (const ev of runWithToolContext(
        sessionId,
        () =>
          engine.runStream(msgs, {
            model,
            tools,
            toolMask,
            ...host.engineStreamOpts(sessionId, signal),
          }),
        { repos: conv().repos },
      )) {
        if (ev.event === "awaiting_clarify") {
          await applyClarifyStreamAwaiting(conv(), sessionId, ev.data.items, ev.data.timeout_sec);
        }
        yield ev;
      }
    } catch (e) {
      if (e instanceof engine.EngineTurnInterrupted) {
        yield { event: "interrupted", data: { reason: e.message } };
        yield { event: "done", data: { reason: "interrupted" } };
        return;
      }
      if (e instanceof engine.MaxTurnsExceeded) {
        const msg = `tool loop exceeded: ${e.message}`;
        logComponent("anima-service").error(msg, { err: e });
        yield { event: "error", data: { error: msg } };
        return;
      }
      if (e instanceof ProviderError) {
        logComponent("anima-service").error(e.message, { err: e });
        yield { event: "error", data: { error: e.message } };
        return;
      }
      const msg = String(e);
      logComponent("anima-service").error(msg, { err: e });
      yield { event: "error", data: { error: msg } };
    }
  } finally {
    host.releaseInFlight();
  }
}

export async function* runExclusiveStreamTurn(
  sessionId: string,
  prepare: () => Promise<[Message[], string[], string]>,
  host: StreamTurnHost,
  sessionManager: SessionManager,
): AsyncGenerator<StreamEvent> {
  const buffer: StreamEvent[] = [];
  let closed = false;
  let wake: (() => void) | null = null;
  const signalReady = () => {
    wake?.();
    wake = null;
  };

  const work = sessionManager.runExclusive(sessionId, async () => {
    let [msgs, functions, effective] = await prepare();
    const cfg = loadConfig();
    const model = getProfileHopModel(cfg, PROFILE_CHAT);
    let hadError = false;
    let sawDone = false;
    let retried = false;

    while (true) {
      hadError = false;
      sawDone = false;
      let pendingDone: StreamEvent | null = null;
      const { signal, controller } = host.beginEngineRun(sessionId);

      try {
        for await (const ev of yieldEngineStream(host, sessionId, msgs, model, signal)) {
          if (ev.event === "done") {
            pendingDone = ev;
            sawDone = true;
            continue;
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
          continue;
        }
        if (!hadError) {
          const reply = lastAssistantText(msgs);
          const displayContent = await host.onTurnAfterComplete(sessionId, msgs, reply);
          if (displayContent !== reply) {
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
          await finalizeTurn(sessionId, msgs, effective, model, functions);
        }
        break;
      } catch (e) {
        hadError = true;
        buffer.push(streamErrorEvent(sessionId, String(e), e));
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
    }
    if (closed) break;
    await new Promise<void>((resolve) => {
      wake = resolve;
      setTimeout(resolve, 50);
    });
  }

  await work;
}
