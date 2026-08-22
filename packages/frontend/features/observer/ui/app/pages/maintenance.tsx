import { AnimaMaintenancePanel } from "@freeanima/features/habitat/ui/habitat/components/habitat/AnimaMaintenancePanel.tsx";
import { useObserverAgentSubjectId } from "@freeanima/features/observer/ui/lib/observer-agent.tsx";

export default function BedroomMaintenancePage() {
  const agentSubjectId = useObserverAgentSubjectId();
  return <AnimaMaintenancePanel agentSubjectId={agentSubjectId} />;
}
