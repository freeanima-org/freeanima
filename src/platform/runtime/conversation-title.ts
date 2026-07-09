import type { EventBus } from "@freeanima/kernel/eventbus";
import { conversationUpdated } from "@freeanima/capabilities/memory";
import { fallbackConversationTitle, generateConversationTitle } from "@freeanima/core/llm";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

export type SessionTitleNotify = {
  bus: EventBus | null;
  onConversationUpdated: ((sid: string) => void) | null;
  /** 含 pokeSessionWatchers 的完整 conversation 更新（优先于 bus/onConversationUpdated） */
  emitSessionUpdated?: (sid: string) => void;
};

const titleGenerationInFlight = new Set<string>();

function emitSessionTitleUpdated(notify: SessionTitleNotify, conversationId: string): void {
  if (notify.emitSessionUpdated) {
    notify.emitSessionUpdated(conversationId);
    return;
  }
  notify.bus?.emit(conversationUpdated, { conversation_id: conversationId });
  notify.onConversationUpdated?.(conversationId);
}

/** @internal test hook */
export function resetConversationTitleGenerationForTests(): void {
  titleGenerationInFlight.clear();
}

/** 首条用户消息后异步生成 conversation 标题（不阻塞主 turn） */
export function maybeGenerateConversationTitleAsync(
  deps: FullRuntimeDeps,
  conversationId: string,
  userText: string,
  notify?: SessionTitleNotify,
): void {
  void (async () => {
    try {
      const existing = (await deps.conversation.getConversationTitle(conversationId)).trim();
      if (existing) return;

      if (titleGenerationInFlight.has(conversationId)) return;

      const userCount = await deps.conversation.countUserMessages(conversationId);
      if (userCount !== 1) return;

      titleGenerationInFlight.add(conversationId);
      try {
        const gen = await generateConversationTitle(userText, { runtime: deps.engine.llm });
        let title = gen.ok ? gen.title : "";
        if (!title) {
          if (!gen.ok) {
            deps.engine.logger
              .with({ component: "conversation-title" })
              .debug("LLM title failed, using text fallback", {
                conversation_id: conversationId,
                error: gen.error,
              });
          }
          title = fallbackConversationTitle(userText);
        }
        if (!title) return;

        const stillEmpty = !(await deps.conversation.getConversationTitle(conversationId)).trim();
        if (stillEmpty) {
          await deps.conversation.setConversationTitle(conversationId, title);
          if (notify) emitSessionTitleUpdated(notify, conversationId);
        }
      } finally {
        titleGenerationInFlight.delete(conversationId);
      }
    } catch (e) {
      deps.engine.logger
        .with({ component: "session-title" })
        .error("conversation title generation failed", { err: e, conversation_id: conversationId });
    }
  })();
}
