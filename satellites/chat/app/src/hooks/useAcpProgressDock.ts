import { useCallback, useEffect, useRef, useState } from "react";
import { getConversationAcpDock, subscribeConversationEvents } from "@chat/lib/api.ts";
import type { ConversationAcpDockSnapshot } from "@chat/lib/types.ts";

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

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setDock(null);
      return;
    }
    try {
      const snap = await getConversationAcpDock(conversationId);
      if (!snap.tasks.length) {
        setDock(null);
        return;
      }
      setDock(snap);
      const { patchProgress, onDecision } = optsRef.current ?? {};
      if (snap.highlight_decision) {
        await onDecision?.(conversationId);
      } else if (snap.progress_text) {
        const pmid = snap.tasks.find((t) => t.progress_message_id)?.progress_message_id;
        patchProgress?.(snap.progress_text, pmid);
      }
    } catch {
      setDock(null);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setDock(null);
      return;
    }
    void refresh();
    const sub = subscribeConversationEvents(conversationId, () => {
      void refresh();
    });
    return () => sub.unsubscribe();
  }, [conversationId, refresh]);

  return dock?.tasks.length ? dock : null;
}
