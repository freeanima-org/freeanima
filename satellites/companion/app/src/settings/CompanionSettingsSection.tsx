import { useEffect } from "react";
import { SettingsPanel } from "../components/SettingsPanel.tsx";
import { useCompanionStore } from "../stores/companion.ts";

type Props = {
  platform: "desktop" | "mobile";
};

export default function CompanionSettingsSection({ platform }: Props) {
  useEffect(() => {
    void useCompanionStore.getState().init();
  }, []);

  if (platform === "mobile") {
    return <p className="text-sm text-base-content/60">伴侣设置仅桌面端可用</p>;
  }

  return <SettingsPanel standalone />;
}
