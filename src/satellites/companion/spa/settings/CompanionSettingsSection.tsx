import { useEffect } from "react";
import type { SettingsPanelProps, SettingsStore } from "@freeanima/shell-sdk/settings";
import type { ClientCompanionConfig } from "@shared/constants.ts";

import { SettingsPanel } from "../components/SettingsPanel.tsx";
import { useCompanionStore } from "../stores/companion.ts";

export default function CompanionSettingsSection({ platform, store, deps }: SettingsPanelProps) {
  useEffect(() => {
    void useCompanionStore
      .getState()
      .initFromStore(store as SettingsStore<ClientCompanionConfig>, deps?.companion);
  }, [store, deps]);

  if (platform === "mobile") {
    return <p className="text-sm text-muted-foreground">伴侣设置仅桌面端可用</p>;
  }

  return <SettingsPanel standalone />;
}
