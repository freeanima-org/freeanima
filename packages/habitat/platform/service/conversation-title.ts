import type { Kernel } from "@freeanima/habitat/kernel";
import { conversationUpdated } from "@freeanima/habitat/capabilities/memory";
import { fallbackConversationTitle, generateConversationTitle } from "@freeanima/habitat/core/llm";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

export type SessionTitleNotify = {
  kernel: Kernel;
  onConversationUpdated: ((sid: string) => void) | null;
  /** 含 pokeSessionWatchers 的完整 conversation 更新（优先于 kernel emit / onConversationUpdated） */
  emitSessionUpdated?: (sid: string) => void;
};

const titleGenerationInFlight = new Set<string>();
/** 跨会话串行：多会话首条消息时避免并行打 summary 触发 429 */
let titleGenerationTail: Promise<void> = Promise.resolve();

function enqueueTitleGeneration<T>(fn: () => Promise<T>): Promise<T> {
  const run = titleGenerationTail.then(fn);
  titleGenerationTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function emitSessionTitleUpdated(notify: SessionTitleNotify, conversationId: string): void {
  if (notify.emitSessionUpdated) {
    notify.emitSessionUpdated(conversationId);
    return;
  }
  notify.kernel.hookRegistry.emit(
    conversationUpdated,
    { conversation_id: conversationId },
    { llm_kind: "conversation" },
  );
  notify.onConversationUpdated?.(conversationId);
}

/** @internal test hook */
export function resetConversationTitleGenerationForTests(): void {
  titleGenerationInFlight.clear();
  titleGenerationTail = Promise.resolve();
}

export type ConversationTitleGenOpts = {
  /** 调用方已在 beginTurnFast 后确认仅一条 user 消息，跳过异步阶段重复计数 */
  firstTurn?: boolean;
};

/** beginTurnFast 之后同步判定：无标题且恰有一条 user 消息 */
export async function shouldGenerateConversationTitle(
  deps: FullRuntimeDeps,
  conversationId: string,
): Promise<boolean> {
  if ((await deps.conversation.getConversationTitle(conversationId)).trim()) return false;
  return (await deps.conversation.countUserMessages(conversationId)) === 1;
}

/** beginTurnFast 后调用：同步门禁 + 异步 LLM 标题（不阻塞主 turn） */
export async function triggerConversationTitleIfFirstTurn(
  deps: FullRuntimeDeps,
  conversationId: string,
  userText: string,
  notify?: SessionTitleNotify,
): Promise<void> {
  if (!(await shouldGenerateConversationTitle(deps, conversationId))) return;
  maybeGenerateConversationTitleAsync(deps, conversationId, userText, notify, { firstTurn: true });
}

/** 首条用户消息后异步生成 conversation 标题（不阻塞主 turn） */
export function maybeGenerateConversationTitleAsync(
  deps: FullRuntimeDeps,
  conversationId: string,
  userText: string,
  notify?: SessionTitleNotify,
  opts?: ConversationTitleGenOpts,
): void {
  void (async () => {
    try {
      const existing = (await deps.conversation.getConversationTitle(conversationId)).trim();
      if (existing) return;

      if (titleGenerationInFlight.has(conversationId)) return;
      titleGenerationInFlight.add(conversationId);

      try {
        if (!opts?.firstTurn) {
          const userCount = await deps.conversation.countUserMessages(conversationId);
          if (userCount !== 1) return;
        }

        await enqueueTitleGeneration(async () => {
          const log = deps.engine.logger.with({ component: "conversation-title" });
          const gen = await generateConversationTitle(userText, {
            runtime: deps.engine.llm,
            parentConversationId: conversationId,
          });
          let title = gen.ok ? gen.title : "";
          if (!title) {
            const fallback = fallbackConversationTitle(userText);
            if (!gen.ok) {
              log.warn("LLM title failed, using text fallback", {
                conversation_id: conversationId,
                error: gen.error,
                fallback_title: fallback || undefined,
                model: gen.model,
                finish_reason: gen.finish_reason ?? undefined,
                had_reasoning: gen.had_reasoning,
              });
            }
            title = fallback;
          }
          if (!title) {
            log.warn("conversation title unavailable: empty user text", {
              conversation_id: conversationId,
            });
            return;
          }

          const stillEmpty = !(await deps.conversation.getConversationTitle(conversationId)).trim();
          if (stillEmpty) {
            await deps.conversation.setConversationTitle(conversationId, title);
            if (notify) emitSessionTitleUpdated(notify, conversationId);
          }
        });
      } finally {
        titleGenerationInFlight.delete(conversationId);
      }
    } catch (e) {
      deps.engine.logger
        .with({ component: "conversation-title" })
        .error("conversation title generation failed", { err: e, conversation_id: conversationId });
    }
  })();
}
