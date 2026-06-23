import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSessionAcpDock,
  subscribeSessionEvents,
  type SessionAcpDockSnapshot,
} from "@/lib/api.ts";

export type AcpProgressDockOptions = {
  patchProgress?: (text: string, progressMessageId?: string) => void;
  onDecision?: (sessionId: string) => void | Promise<void>;
};

export function useAcpProgressDock(
  sessionId: string | null | undefined,
  opts?: AcpProgressDockOptions,
): SessionAcpDockSnapshot | null {
  const [dock, setDock] = useState<SessionAcpDockSnapshot | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const decisionHandledRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setDock(null);
      return;
    }
    try {
      const snap = await getSessionAcpDock(sessionId);
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
          await onDecision?.(sessionId);
        }
      } else {
        decisionHandledRef.current = false;
        if (snap.progress_text) {
          const pmid = snap.tasks.find((t) => t.progress_message_id)?.progress_message_id;
          patchProgress?.(snap.progress_text, pmid);
        }
      }
    } catch {
      setDock(null);
      decisionHandledRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setDock(null);
      decisionHandledRef.current = false;
      return;
    }
    void refresh();
    const sub = subscribeSessionEvents(sessionId, () => {
      void refresh();
    });
    return () => {
      sub.unsubscribe();
      decisionHandledRef.current = false;
    };
  }, [sessionId, refresh]);

  return dock?.tasks.length ? dock : null;
}
