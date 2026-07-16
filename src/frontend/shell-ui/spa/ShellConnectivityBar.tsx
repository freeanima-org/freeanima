import {
  reconnectHub,
  useHubConnection,
  useNetworkOnline,
} from "@freeanima/frontend/shell-sdk/react.tsx";
import {
  dismissShellToast,
  showShellToast,
  SHELL_TOAST_IDS,
} from "@freeanima/frontend/ui-kit/composite";
import { useEffect, useRef } from "react";

import { m } from "@paraglide/messages";
import { resolveConnectivityNotice } from "./connectivity-notice.ts";

function openHubSettingsIfAvailable(): void {
  window.satelliteShell?.openHubSettings?.();
}

export function ShellConnectivityBar(): null {
  const networkOnline = useNetworkOnline();
  const hubConnection = useHubConnection();
  const reconnectingRef = useRef(false);
  const nativeShell = Boolean(window.satelliteShell?.isNativeShell);

  const notice = resolveConnectivityNotice({ networkOnline, hubConnection });

  useEffect(() => {
    if (!notice) {
      dismissShellToast(SHELL_TOAST_IDS.connectivity);
      return;
    }

    if (notice.kind === "offline") {
      showShellToast(SHELL_TOAST_IDS.connectivity, m.ui_network_offline(), {
        description: m.ui_offline_readonly_mode(),
      });
      return;
    }

    if (notice.kind === "hub-connecting") {
      showShellToast(SHELL_TOAST_IDS.connectivity, m.console_common_connecting());
      return;
    }

    showShellToast(SHELL_TOAST_IDS.connectivity, m.console_hub_disconnected(), {
      action: {
        label: m.console_common_reconnect(),
        onClick: () => {
          if (reconnectingRef.current || hubConnection === "connecting") return;
          reconnectingRef.current = true;
          void reconnectHub().finally(() => {
            reconnectingRef.current = false;
          });
        },
      },
      ...(nativeShell
        ? {
            cancel: {
              label: "Hub 设置",
              onClick: openHubSettingsIfAvailable,
            },
          }
        : {}),
    });
  }, [hubConnection, nativeShell, notice]);

  return null;
}
