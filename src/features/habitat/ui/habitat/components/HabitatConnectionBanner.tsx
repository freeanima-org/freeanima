import { Button } from "@freeanima/ui-kit";
import { canOpenHabitatSettings } from "@freeanima/client/portal-sdk/shell-runtime.ts";
import type { HabitatRpcConnectionState } from "@freeanima/features/habitat/ui/habitat/hooks/useHabitatRpcConnectivity.ts";

type Props = {
  state: HabitatRpcConnectionState;
  onRetry: () => void;
};

function openHabitatSettingsIfAvailable(): void {
  window.portalShell?.openHabitatSettings?.();
}

export function HabitatConnectionBanner({ state, onRetry }: Props) {
  if (state === "connected") return null;

  const showHabitatSettings = canOpenHabitatSettings();

  return (
    <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-warning/15 border-b border-yellow-500/50/30 text-sm">
      <span className="text-yellow-700 dark:text-yellow-300/90">
        {state === "connecting" ? "连接中" : "连接已断开"}
      </span>
      <div className="flex items-center gap-1">
        {showHabitatSettings ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={openHabitatSettingsIfAvailable}
          >
            连接设置
          </Button>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          isDisabled={state === "connecting"}
          onClick={() => void onRetry()}
        >
          {"重连"}
        </Button>
      </div>
    </div>
  );
}
