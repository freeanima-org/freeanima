import { useCompanionStore } from "@/stores/companion.ts";
import { SettingsTabs } from "./settings/SettingsTabs.tsx";
import { GeneralTab } from "./settings/GeneralTab.tsx";
import { BehaviorTab } from "./settings/BehaviorTab.tsx";
import { ModelsTab } from "./settings/ModelsTab.tsx";
import { MotionLibraryTab } from "./settings/MotionLibraryTab.tsx";
import { MotionSlotsTab } from "./settings/MotionSlotsTab.tsx";

type Props = {
  standalone?: boolean;
  onClose?: () => void;
};

export function SettingsPanel({ standalone = false, onClose }: Props) {
  const tab = useCompanionStore((s) => s.settingsTab);

  return (
    <div className={standalone ? "settings-panel-standalone" : "settings-panel"}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium">设置</h2>
        {onClose ? (
          <button
            type="button"
            className="text-xs text-white/50 hover:text-white"
            onClick={onClose}
          >
            关闭
          </button>
        ) : null}
      </div>
      <SettingsTabs />
      {tab === "general" ? <GeneralTab /> : null}
      {tab === "behavior" ? <BehaviorTab /> : null}
      {tab === "models" ? <ModelsTab /> : null}
      {tab === "library" ? <MotionLibraryTab /> : null}
      {tab === "slots" ? <MotionSlotsTab /> : null}
    </div>
  );
}
