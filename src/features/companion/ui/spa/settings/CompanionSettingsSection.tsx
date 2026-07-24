import { useEffect } from "react";
import type { SettingsPanelProps } from "@freeanima/frontend/portal-sdk/settings";

import { SettingsPanel } from "../components/SettingsPanel.tsx";
import { useCompanionStore } from "../stores/companion.ts";

export default function CompanionSettingsSection({ deps }: SettingsPanelProps) {
  useEffect(() => {
    void useCompanionStore.getState().initHabitatSettings();
  }, []);

  return <SettingsPanel standalone hubOnly {...(deps ? { deps } : {})} />;
}
