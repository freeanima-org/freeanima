import { lazy, Suspense } from "react";
import { Button, Card, CardContent, Spinner } from "@freeanima/frontend/ui-kit";
import type { SettingsSectionDeps } from "@freeanima/frontend/portal-sdk/settings";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import { SettingsTabs } from "./settings/SettingsTabs.tsx";
import { BehaviorTab } from "./settings/BehaviorTab.tsx";
import { ModelsTab } from "./settings/ModelsTab.tsx";
import { MotionSlotsTab } from "./settings/MotionSlotsTab.tsx";

/** three / VRM 预览挂在动作库 tab — 按需分包，避免设置面板一开就拉整包 3D */
const MotionLibraryTab = lazy(() =>
  import("./settings/MotionLibraryTab.tsx").then((m) => ({ default: m.MotionLibraryTab })),
);

type Props = {
  standalone?: boolean;
  hubOnly?: boolean;
  onClose?: () => void;
  deps?: SettingsSectionDeps;
};

function TabFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <Spinner className="size-6" />
    </div>
  );
}

export function SettingsPanel({ standalone = false, onClose, deps: _deps }: Props) {
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
          {tab === "behavior" ? <BehaviorTab /> : null}
          {tab === "models" ? <ModelsTab /> : null}
          {tab === "library" ? (
            <Suspense fallback={<TabFallback />}>
              <MotionLibraryTab />
            </Suspense>
          ) : null}
          {tab === "slots" ? <MotionSlotsTab /> : null}
        </div>
      </CardContent>
    </Card>
  );
}
