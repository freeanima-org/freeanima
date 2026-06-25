import { useCallback, useEffect, useRef, useState } from "react";
import {
  getConversationAcpDock,
  subscribeConversationEvents,
  type ConversationAcpDockSnapshot,
} from "@admin/lib/api.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";

export type AcpProgressDockOptions = {
  patchProgress?: (text: string, progressMessageId?: string) => void;
  onDecision?: (conversationId: string) => void | Promise<void>;
};

export function useAcpProgressDock(
  conversationId: string | null | undefined,
  opts?: AcpProgressDockOptions,
): ConversationAcpDockSnapshot | null {
  const [dock, setDock] = useState<ConversationAcpDockSnapshot | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const decisionHandledRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setDock(null);
      return;
    }
    try {
      const snap = await getConversationAcpDock(conversationId);
      if (!snap.tasks.length) {
        setDock(null);
        decisionHandledRef.current = false;
        return;
      }
      setDock(snap);
      const { patchProgress, onDecision } = optsRef.current ?? {};
      if (snap.highlight_decision) {
        if (!decisionHandledRef.current) {
          decisionHandledRef.current = true;
          await onDecision?.(conversationId);
        }
      } else {
        decisionHandledRef.current = false;
        if (snap.progress_text) {
          const pmid = snap.tasks.find((t) => t.progress_message_id)?.progress_message_id;
          patchProgress?.(snap.progress_text, pmid);
        }
      }
    } catch (err) {
      logCaughtError("hooks/useAcpProgressDock/refresh", err);
      setDock(null);
      decisionHandledRef.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setDock(null);
      decisionHandledRef.current = false;
      return;
    }
    void refresh();
    const sub = subscribeConversationEvents(conversationId, () => {
      void refresh();
    });
    return () => {
      sub.unsubscribe();
      decisionHandledRef.current = false;
    };
  }, [conversationId, refresh]);

  return dock?.tasks.length ? dock : null;
}
