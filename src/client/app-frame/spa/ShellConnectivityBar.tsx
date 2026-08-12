import {
  reconnectHabitat,
  useHabitatConnection,
  useNetworkOnline,
  useOpenHabitatSettingsCapability,
} from "@freeanima/client/portal-sdk/react.tsx";
import { dismissShellToast, showShellToast, SHELL_TOAST_IDS } from "@freeanima/ui-kit/composite";
import { useEffect, useRef } from "react";

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
      showShellToast(
        SHELL_TOAST_IDS.connectivity,
        "当前处于离线状态，服务实时功能不可用；部分页面可能仍显示已缓存的数据。",
        {
          description: "离线只读 — 恢复在线前无法编辑。",
        },
      );
      return;
    }

    if (notice.kind === "habitat-connecting") {
      showShellToast(SHELL_TOAST_IDS.connectivity, "连接中");
      return;
    }

    showShellToast(SHELL_TOAST_IDS.connectivity, "连接已断开", {
      action: {
        label: "重连",
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
