import { useEffect } from "react";
import type { SettingsPanelProps } from "@freeanima/satellite-sdk";
import { SettingsPanel } from "../components/SettingsPanel.tsx";
import { bindCompanionSettingsStore, useCompanionStore } from "../stores/companion.ts";

export default function CompanionSettingsSection({ store, platform }: SettingsPanelProps) {
  useEffect(() => {
    bindCompanionSettingsStore(store);
    void useCompanionStore.getState().init();
    return () => {
      bindCompanionSettingsStore(null);
    };
  }, [store]);

  if (platform === "mobile") {
    return <p className="text-sm text-base-content/60">伴侣设置仅桌面端可用</p>;
  }

  return <SettingsPanel standalone />;
}
