import {
  clearLocalPrefer,
  reconnectHabitat,
  useHabitatConnection,
  useLocalPrefer,
  useNetworkOnline,
  useOpenHabitatSettingsCapability,
} from "@freeanima/client/portal-sdk/react.tsx";
import { subscribeBundledHabitatRpcConfigChanges } from "@freeanima/shared/habitat-rpc/bundled-browser.ts";
import { dismissShellToast, showShellToast, SHELL_TOAST_IDS } from "@freeanima/ui-kit/composite";
import { useEffect, useRef } from "react";

import { resolveConnectivityNotice } from "./connectivity-notice.ts";

function openHabitatSettingsIfAvailable(): void {
  window.portalShell?.openHabitatSettings?.();
}

export function ShellConnectivityBar(): null {
  const networkOnline = useNetworkOnline();
  const habitatConnection = useHabitatConnection();
  const localPrefer = useLocalPrefer();
  const reconnectingRef = useRef(false);
  const canOpenHabitatSettings = useOpenHabitatSettingsCapability();

  const notice = resolveConnectivityNotice({
    networkOnline,
    habitatConnection,
    localPrefer,
  });

  // 设置页保存 Habitat 时 Chat/Diary 可能未挂载；条幅级监听才能强制重连
  useEffect(() => subscribeBundledHabitatRpcConfigChanges(), []);

  useEffect(() => {
    if (!notice) {
      dismissShellToast(SHELL_TOAST_IDS.connectivity);
      return;
    }

    if (notice.kind === "offline") {
      showShellToast(
        SHELL_TOAST_IDS.connectivity,
        "当前处于离线状态，服务实时功能不可用；已缓存的任务、日记、笔记仍可编辑，恢复后自动同步。",
        {
          description: "离线可编辑 — 更改会排队，待恢复连接后同步。",
        },
      );
      return;
    }

    if (notice.kind === "local-prefer") {
      showShellToast(SHELL_TOAST_IDS.connectivity, "网络响应较慢，已改用本地数据与排队同步。", {
        description: "任务、日记、笔记可继续编辑；恢复后会自动同步。",
        action: {
          label: "尝试恢复",
          onClick: () => {
            clearLocalPrefer();
            if (reconnectingRef.current) return;
            reconnectingRef.current = true;
            void reconnectHabitat({ force: true })
              .catch(() => undefined)
              .finally(() => {
                reconnectingRef.current = false;
              });
          },
        },
      });
      return;
    }

    if (notice.kind === "habitat-connecting") {
      // 条幅指 WebSocket 实时通道；Portal 列表/CRUD 默认 HTTP，连接中仍可读写
      showShellToast(SHELL_TOAST_IDS.connectivity, "实时通道连接中", {
        description: "列表与多数写入仍可用；推送与少数仅 WS 能力需通道就绪。",
        action: {
          label: "重连",
          onClick: () => {
            if (reconnectingRef.current) return;
            reconnectingRef.current = true;
            void reconnectHabitat({ force: true })
              .catch(() => undefined)
              .finally(() => {
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
      return;
    }

    showShellToast(SHELL_TOAST_IDS.connectivity, "连接已断开", {
      action: {
        label: "重连",
        onClick: () => {
          if (reconnectingRef.current) return;
          reconnectingRef.current = true;
          void reconnectHabitat({ force: true })
            .catch(() => undefined)
            .finally(() => {
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
