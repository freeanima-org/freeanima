import { useMemo } from "react";
import {
  useAcpProgressDock as useSharedAcpProgressDock,
  type AcpProgressDockOptions,
} from "@freeanima/ui-kit/ui/use-acp-progress-dock";
import {
  getConversationAcpDock,
  subscribeConversationEvents,
  type ConversationAcpDockSnapshot,
} from "@admin/lib/api.ts";
import { logCaughtError } from "@admin/lib/log-caught-error.ts";

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
