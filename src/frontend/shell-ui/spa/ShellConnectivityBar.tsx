import { Button } from "@freeanima/frontend/ui-kit";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import {
  reconnectHub,
  useHubConnection,
  useNetworkOnline,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import { useState, type JSX } from "react";

import { m } from "@paraglide/messages";
import { resolveConnectivityNotice } from "./connectivity-notice.ts";

function openHubSettingsIfAvailable(): void {
  window.satelliteShell?.openHubSettings?.();
}

export function ShellConnectivityBar(): JSX.Element | null {
  const networkOnline = useNetworkOnline();
  const hubConnection = useHubConnection();
  const [reconnecting, setReconnecting] = useState(false);
  const nativeShell = Boolean(window.satelliteShell?.isNativeShell);

  const notice = resolveConnectivityNotice({ networkOnline, hubConnection });
  if (!notice) return null;

  if (notice.kind === "offline") {
    return (
      <div className="shrink-0 border-b border-border px-4 py-2">
        <StatusAlert variant="warning">
          <div className="flex flex-col gap-1">
            <span>{m.ui_network_offline()}</span>
            <span className="text-xs opacity-90">{m.ui_offline_readonly_mode()}</span>
          </div>
        </StatusAlert>
      </div>
    );
  }

  if (notice.kind === "hub-connecting") {
    return (
      <div className="shrink-0 border-b border-border px-4 py-2">
        <StatusAlert variant="info">{m.console_common_connecting()}</StatusAlert>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      <StatusAlert variant="warning" className="flex flex-wrap items-center justify-between gap-2">
        <span>{m.console_hub_disconnected()}</span>
        <div className="flex items-center gap-1">
          {nativeShell ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={openHubSettingsIfAvailable}
            >
              Hub 设置
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={reconnecting || hubConnection === "connecting"}
            onClick={() => {
              setReconnecting(true);
              void reconnectHub().finally(() => setReconnecting(false));
            }}
          >
            {m.console_common_reconnect()}
          </Button>
        </div>
      </StatusAlert>
    </div>
  );
}
