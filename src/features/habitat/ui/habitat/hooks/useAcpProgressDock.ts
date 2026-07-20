import { useMemo } from "react";
import {
  useAcpProgressDock as useSharedAcpProgressDock,
  type AcpProgressDockOptions,
} from "@freeanima/frontend/ui-kit/ui/useAcpProgressDock.ts";
import {
  getConversationAcpDock,
  subscribeConversationEvents,
  type ConversationAcpDockSnapshot,
} from "@freeanima/features/habitat/ui/habitat/lib/api.ts";
import { logCaughtError } from "@freeanima/features/habitat/ui/habitat/lib/log-caught-error.ts";

export type { AcpProgressDockOptions };

export function useAcpProgressDock(
  conversationId: string | null | undefined,
  opts?: AcpProgressDockOptions,
): ConversationAcpDockSnapshot | null {
  const adapter = useMemo(
    () => ({
      getDock: getConversationAcpDock,
      subscribe: subscribeConversationEvents,
      onError: logCaughtError,
    }),
    [],
  );
  return useSharedAcpProgressDock(conversationId, adapter, opts);
}
