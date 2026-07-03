import { AcpProgressDock as SharedAcpProgressDock } from "@freeanima/ui-kit/ui/acp";
import type { ConversationAcpDockSnapshot } from "@admin/lib/api.ts";

export function AcpProgressDock({ dock }: { dock: ConversationAcpDockSnapshot }) {
  return <SharedAcpProgressDock dock={dock} />;
}
