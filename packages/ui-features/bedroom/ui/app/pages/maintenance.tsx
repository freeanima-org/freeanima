import { AnimaMaintenancePanel } from "@freeanima/ui-features/habitat/ui/habitat/components/habitat/AnimaMaintenancePanel.tsx";
import { useBedroomAgentSubjectId } from "@freeanima/ui-features/bedroom/ui/lib/bedroom-agent.tsx";

export default function BedroomMaintenancePage() {
  const agentSubjectId = useBedroomAgentSubjectId();
  return <AnimaMaintenancePanel agentSubjectId={agentSubjectId} />;
}
