import { useMemo } from "react";
import {
  useAcpProgressDock as useSharedAcpProgressDock,
  type AcpProgressDockOptions,
} from "@freeanima/satellite-sdk/ui/use-acp-progress-dock";
import { getConversationAcpDock, subscribeConversationEvents } from "@chat/lib/api.ts";
import type { ConversationAcpDockSnapshot } from "@chat/lib/types.ts";

export type { AcpProgressDockOptions };

const chatAcpAdapter = {
  getDock: getConversationAcpDock,
  subscribe: subscribeConversationEvents,
};

export function useAcpProgressDock(
  conversationId: string | null | undefined,
  opts?: AcpProgressDockOptions,
): ConversationAcpDockSnapshot | null {
  const adapter = useMemo(() => chatAcpAdapter, []);
  return useSharedAcpProgressDock(conversationId, adapter, opts);
}
