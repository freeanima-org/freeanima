import {
  reconnectHabitat,
  useHabitatConnection,
  useNetworkOnline,
  useOpenHabitatSettingsCapability,
} from "@freeanima/frontend/portal-sdk/react.tsx";
import {
  dismissShellToast,
  showShellToast,
  SHELL_TOAST_IDS,
} from "@freeanima/frontend/ui-kit/composite";
import { useEffect, useRef } from "react";

import { m } from "@paraglide/messages";
import { resolveConnectivityNotice } from "./connectivity-notice.ts";

function openHabitatSettingsIfAvailable(): void {
  window.portalShell?.openHabitatSettings?.();
}

export function ShellConnectivityBar(): null {
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const reconnectingRef = useRef(false);
  const canOpenHabitatSettings = useOpenHabitatSettingsCapability();

  const notice = resolveConnectivityNotice({ networkOnline, habitatConnection });

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

    if (notice.kind === "habitat-connecting") {
      showShellToast(SHELL_TOAST_IDS.connectivity, m.habitat_common_connecting());
      return;
    }

    showShellToast(SHELL_TOAST_IDS.connectivity, m.habitat_disconnected(), {
      action: {
        label: m.habitat_common_reconnect(),
        onClick: () => {
          if (reconnectingRef.current || habitatConnection === "connecting") return;
          reconnectingRef.current = true;
          void reconnectHabitat().finally(() => {
            reconnectingRef.current = false;
          });
        },
      },
      ...(canOpenHabitatSettings
        ? {
            cancel: {
              label: "连接设置",
              onClick: openHabitatSettingsIfAvailable,
            },
          }
        : {}),
    });
  }, [canOpenHabitatSettings, habitatConnection, notice]);

  return null;
}
