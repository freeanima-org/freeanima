import { useCallback, useEffect, useRef, useState } from "react";

import type { AcpDockTask, ConversationAcpDockSnapshot } from "./acp-dock-types.ts";

export type { AcpDockTask, ConversationAcpDockSnapshot };

export type AcpProgressDockOptions = {
  patchProgress?: (text: string, progressMessageId?: string) => void;
  onDecision?: (conversationId: string) => void | Promise<void>;
};

export type AcpProgressDockAdapter = {
  getDock: (conversationId: string) => Promise<ConversationAcpDockSnapshot>;
  subscribe: (conversationId: string, onEvent: () => void) => { unsubscribe: () => void };
  onError?: (scope: string, err: unknown) => void;
};

export function useAcpProgressDock(
  conversationId: string | null | undefined,
  adapter: AcpProgressDockAdapter,
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
      const snap = await adapter.getDock(conversationId);
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
          const pmid = snap.tasks.find(
            (t: AcpDockTask) => t.progress_message_id,
          )?.progress_message_id;
          patchProgress?.(snap.progress_text, pmid ?? undefined);
        }
      }
    } catch (err) {
      adapter.onError?.("useAcpProgressDock/refresh", err);
      setDock(null);
      decisionHandledRef.current = false;
    }
  }, [conversationId, adapter]);

  useEffect(() => {
    if (!conversationId) {
      setDock(null);
      decisionHandledRef.current = false;
      return;
    }
    void refresh();
    const sub = adapter.subscribe(conversationId, () => {
      void refresh();
    });
    return () => {
      sub.unsubscribe();
      decisionHandledRef.current = false;
    };
  }, [conversationId, refresh, adapter]);

  return dock?.tasks.length ? dock : null;
}
