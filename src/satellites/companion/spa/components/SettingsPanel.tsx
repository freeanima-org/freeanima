import { Button, Card, CardContent } from "@freeanima/frontend/ui-kit";
import type { SettingsSectionDeps } from "@freeanima/frontend/shell-sdk/settings";
import { useCompanionStore } from "@freeanima/satellites/companion/spa/stores/companion.ts";
import { SettingsTabs } from "./settings/SettingsTabs.tsx";
import { GeneralTab } from "./settings/GeneralTab.tsx";
import { BehaviorTab } from "./settings/BehaviorTab.tsx";
import { ModelsTab } from "./settings/ModelsTab.tsx";
import { MotionLibraryTab } from "./settings/MotionLibraryTab.tsx";
import { MotionSlotsTab } from "./settings/MotionSlotsTab.tsx";

type Props = {
  standalone?: boolean;
  onClose?: () => void;
  deps?: SettingsSectionDeps;
};

export function SettingsPanel({ standalone = false, onClose, deps }: Props) {
  const tab = useCompanionStore((s) => s.settingsTab);

  return (
    <Card
      className={
        standalone
          ? "h-full w-full max-w-none shrink-0 rounded-none shadow-none gap-0 py-0"
          : "w-[800px] max-w-[800px] shrink-0 shadow-xl h-[min(720px,90vh)] gap-0 py-0"
      }
    >
      <CardContent className="flex flex-col gap-0 p-0 min-h-0 h-full">
        <header className="flex items-center justify-between gap-3 px-5 py-2 border-b border shrink-0">
          <h2 className="text-base font-semibold leading-none">设置</h2>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onClose}
            >
              关闭
            </Button>
          ) : null}
        </header>

        <SettingsTabs />

        <div
          className={`flex-1 min-h-0 px-5 pb-4 pt-3 ${
            tab === "library" ? "flex flex-col overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {tab === "general" ? (
            <GeneralTab {...(deps?.companion ? { companionApi: deps.companion } : {})} />
          ) : null}
          {tab === "behavior" ? <BehaviorTab /> : null}
          {tab === "models" ? <ModelsTab /> : null}
          {tab === "library" ? <MotionLibraryTab /> : null}
          {tab === "slots" ? <MotionSlotsTab /> : null}
        </div>
      </CardContent>
    </Card>
  );
}
