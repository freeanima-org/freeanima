import type { EventBus } from "@freeanima/kernel/eventbus";
import { sessionUpdated } from "@freeanima/capabilities-memory";
import { fallbackSessionTitle, generateSessionTitle } from "@freeanima/core/llm";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

export type SessionTitleNotify = {
  bus: EventBus | null;
  onSessionUpdated: ((sid: string) => void) | null;
  /** 含 pokeSessionWatchers 的完整 session 更新（优先于 bus/onSessionUpdated） */
  emitSessionUpdated?: (sid: string) => void;
};

const titleGenerationInFlight = new Set<string>();

function emitSessionTitleUpdated(notify: SessionTitleNotify, sessionId: string): void {
  if (notify.emitSessionUpdated) {
    notify.emitSessionUpdated(sessionId);
    return;
  }
  notify.bus?.emit(sessionUpdated, { session_id: sessionId });
  notify.onSessionUpdated?.(sessionId);
}

/** @internal test hook */
export function resetSessionTitleGenerationForTests(): void {
  titleGenerationInFlight.clear();
}

/** 首条用户消息后异步生成 session 标题（不阻塞主 turn） */
export function maybeGenerateSessionTitleAsync(
  deps: FullRuntimeDeps,
  sessionId: string,
  userText: string,
  notify?: SessionTitleNotify,
): void {
  void (async () => {
    try {
      const existing = (await deps.conversation.getSessionTitle(sessionId)).trim();
      if (existing) return;

      if (titleGenerationInFlight.has(sessionId)) return;

      const userCount = await deps.conversation.countUserMessages(sessionId);
      if (userCount !== 1) return;

      titleGenerationInFlight.add(sessionId);
      try {
        const gen = await generateSessionTitle(userText, { runtime: deps.engine.llm });
        let title = gen.ok ? gen.title : "";
        if (!title) {
          if (!gen.ok) {
            deps.engine.logger
              .with({ component: "session-title" })
              .debug("LLM title failed, using text fallback", {
                session_id: sessionId,
                error: gen.error,
              });
          }
          title = fallbackSessionTitle(userText);
        }
        if (!title) return;

        const stillEmpty = !(await deps.conversation.getSessionTitle(sessionId)).trim();
        if (stillEmpty) {
          await deps.conversation.setSessionTitle(sessionId, title);
          if (notify) emitSessionTitleUpdated(notify, sessionId);
        }
      } finally {
        titleGenerationInFlight.delete(sessionId);
      }
    } catch (e) {
      deps.engine.logger
        .with({ component: "session-title" })
        .error("session title generation failed", { err: e, session_id: sessionId });
    }
  })();
}
