import { useEffect } from "react";
import type { SettingsPanelProps } from "@freeanima/frontend/shell-sdk/settings";

import { SettingsPanel } from "../components/SettingsPanel.tsx";
import { useCompanionStore } from "../stores/companion.ts";

export default function CompanionSettingsSection({ platform, deps }: SettingsPanelProps) {
  useEffect(() => {
    void useCompanionStore.getState().initHubSettings();
  }, []);

  if (platform === "mobile") {
    return <p className="text-sm text-muted-foreground">伴侣设置仅桌面端可用</p>;
  }

  return <SettingsPanel standalone hubOnly {...(deps ? { deps } : {})} />;
}
