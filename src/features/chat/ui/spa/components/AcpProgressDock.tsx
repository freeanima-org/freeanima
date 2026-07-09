import { AcpProgressDock as SharedAcpProgressDock } from "@freeanima/frontend/ui-kit/ui/AcpProgressDock.tsx";
import type { ConversationAcpDockSnapshot } from "@freeanima/features/chat/ui/spa/lib/types.ts";

export function AcpProgressDock({ dock }: { dock: ConversationAcpDockSnapshot }) {
  return <SharedAcpProgressDock dock={dock} />;
}
