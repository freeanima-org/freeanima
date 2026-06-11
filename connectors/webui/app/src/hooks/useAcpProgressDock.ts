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

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setDock(null);
      return;
    }
    try {
      const snap = await getSessionAcpDock(sessionId);
      if (!snap.tasks.length) {
        setDock(null);
        return;
      }
      setDock(snap);
      const { patchProgress, onDecision } = optsRef.current ?? {};
      if (snap.highlight_decision) {
        await onDecision?.(sessionId);
      } else if (snap.progress_text) {
        const pmid = snap.tasks.find((t) => t.progress_message_id)?.progress_message_id;
        patchProgress?.(snap.progress_text, pmid);
      }
    } catch {
      setDock(null);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setDock(null);
      return;
    }
    void refresh();
    const sub = subscribeSessionEvents(sessionId, () => {
      void refresh();
    });
    return () => sub.unsubscribe();
  }, [sessionId, refresh]);

  return dock?.tasks.length ? dock : null;
}
