import { AcpProgressDock as SharedAcpProgressDock } from "@freeanima/frontend/ui-kit/ui/AcpProgressDock.tsx";
import type { ConversationAcpDockSnapshot } from "@freeanima/features/habitat/ui/habitat/lib/api.ts";

export function AcpProgressDock({ dock }: { dock: ConversationAcpDockSnapshot }) {
  return <SharedAcpProgressDock dock={dock} />;
}
