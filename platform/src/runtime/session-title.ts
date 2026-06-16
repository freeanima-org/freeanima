import type { EventBus } from "@freeanima/kernel/eventbus";
import { sessionUpdated } from "@freeanima/capabilities-memory";
import { fallbackSessionTitle, generateSessionTitle } from "@freeanima/core/llm";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

export type SessionTitleNotify = {
  bus: EventBus | null;
  onSessionUpdated: ((sid: string) => void) | null;
};

const titleGenerationInFlight = new Set<string>();

function emitSessionTitleUpdated(notify: SessionTitleNotify, sessionId: string): void {
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

      const count = await deps.conversation.countMessages(sessionId);
      if (count !== 1) return;

      titleGenerationInFlight.add(sessionId);
      try {
        const gen = await generateSessionTitle(userText, { runtime: deps.engine.llm });
        const title = gen.ok ? gen.title : fallbackSessionTitle(userText);
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
