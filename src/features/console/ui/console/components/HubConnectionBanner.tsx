import { Button } from "@freeanima/frontend/ui-kit";
import { canOpenHubSettings } from "@freeanima/frontend/shell-sdk/shell-runtime.ts";
import { m } from "@freeanima/features/console/ui/console/lib/i18n.ts";
import type { HubRpcConnectionState } from "@freeanima/features/console/ui/console/hooks/useHubRpcConnectivity.ts";

type Props = {
  state: HubRpcConnectionState;
  onRetry: () => void;
};

function openHubSettingsIfAvailable(): void {
  window.satelliteShell?.openHubSettings?.();
}

export function HubConnectionBanner({ state, onRetry }: Props) {
  if (state === "connected") return null;

  const showHubSettings = canOpenHubSettings();

  return (
    <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-warning/15 border-b border-yellow-500/50/30 text-sm">
      <span className="text-yellow-700 dark:text-yellow-300/90">
        {state === "connecting" ? m.console_common_connecting() : m.console_hub_disconnected()}
      </span>
      <div className="flex items-center gap-1">
        {showHubSettings ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={openHubSettingsIfAvailable}
          >
            连接设置
          </Button>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          disabled={state === "connecting"}
          onClick={() => void onRetry()}
        >
          {m.console_common_reconnect()}
        </Button>
      </div>
    </div>
  );
}
