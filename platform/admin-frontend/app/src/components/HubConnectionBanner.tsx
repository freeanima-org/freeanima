import { m } from "@/lib/i18n.ts";
import type { HubRestConnectionState } from "@/hooks/useHubRestConnectivity.ts";

type Props = {
  state: HubRestConnectionState;
  onRetry: () => void;
};

function openHubSettingsIfAvailable(): void {
  window.satelliteShell?.openHubSettings?.();
}

export function HubConnectionBanner({ state, onRetry }: Props) {
  if (state === "connected") return null;

  const nativeShell = Boolean(window.satelliteShell?.isNativeShell);

  return (
    <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-warning/15 border-b border-warning/30 text-sm">
      <span className="text-warning-content/90">
        {state === "connecting" ? m.admin_common_connecting() : m.admin_studio_disconnected()}
      </span>
      <div className="flex items-center gap-1">
        {nativeShell ? (
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={openHubSettingsIfAvailable}
          >
            Hub 设置
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-xs btn-warning"
          disabled={state === "connecting"}
          onClick={() => void onRetry()}
        >
          {m.admin_common_reconnect()}
        </button>
      </div>
    </div>
  );
}
