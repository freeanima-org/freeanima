import { useMemo } from "react";
import {
  useAcpProgressDock as useSharedAcpProgressDock,
  type AcpProgressDockOptions,
} from "@freeanima/ui-kit/ui/useAcpProgressDock.ts";
import {
  getConversationAcpDock,
  subscribeConversationUpdates,
} from "@freeanima/features/chat/ui/spa/lib/api.ts";
import type { ConversationAcpDockSnapshot } from "@freeanima/features/chat/ui/spa/lib/types.ts";

export type { AcpProgressDockOptions };

const chatAcpAdapter = {
  getDock: getConversationAcpDock,
  subscribe: subscribeConversationUpdates,
};

export function useAcpProgressDock(
  conversationId: string | null | undefined,
  opts?: AcpProgressDockOptions,
): ConversationAcpDockSnapshot | null {
  const adapter = useMemo(() => chatAcpAdapter, []);
  return useSharedAcpProgressDock(conversationId, adapter, opts);
}
