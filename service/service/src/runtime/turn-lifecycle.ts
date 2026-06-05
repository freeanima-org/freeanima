import * as conv from "@freeanima/engine-conversation";
import type { SessionMessage } from "@freeanima/kernel-schemas";
import * as engine from "@freeanima/engine-loop";
import { runWithToolContext } from "@freeanima/engine-loop";

/** beginTurn / retryTurn 返回值：[runtimeMsgs, functions, effectiveUserText] */
export type TurnPrepareResult = [SessionMessage[], string[], string];

/** 引擎运行期间逐条 / 批量持久化到会话 */
export function createTurnMessageCallbacks(sessionId: string): {
  onMessageAppended: (msg: SessionMessage) => Promise<void>;
  onToolRoundComplete: (batch: SessionMessage[]) => Promise<void>;
} {
  return {
    onMessageAppended: async (msg) => {
      await conv.appendMessage(msg, sessionId);
    },
    onToolRoundComplete: async (batch) => {
      for (const msg of batch) {
        await conv.appendMessage(msg, sessionId);
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
  await conv.finishTurn(sessionId, msgs, effectiveUserText, model, functions, true);
}

export type RunSimpleTurnOpts = {
  sessionId: string;
  prompt: string;
  model: string;
  /** 默认 conv.beginTurn；retry 等场景可传入 conv.retryTurn */
  prepare?: (sessionId: string, prompt: string) => Promise<TurnPrepareResult>;
};

/**
 * 非流式整轮：beginTurn → engine.run → finishTurn。
 * cron / 脚本等无 SSE 场景使用；nest-service 流式路径复用 callbacks + finalizeTurn。
 */
export async function runSimpleTurn(opts: RunSimpleTurnOpts): Promise<string> {
  const { sessionId, prompt, model, prepare = conv.beginTurn } = opts;
  const [msgs, functions, effective] = await prepare(sessionId, prompt);
  try {
    return await runWithToolContext(sessionId, () =>
      engine.run(msgs, {
        model,
        ...createTurnMessageCallbacks(sessionId),
      }),
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
