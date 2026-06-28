import { AcpProgressDock as SharedAcpProgressDock } from "@freeanima/satellite-sdk/ui/acp";
import type { ConversationAcpDockSnapshot } from "@chat/lib/types.ts";

export function AcpProgressDock({ dock }: { dock: ConversationAcpDockSnapshot }) {
  return <SharedAcpProgressDock dock={dock} />;
}
