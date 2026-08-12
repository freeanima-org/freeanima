import { COMPACT_LAYOUT_MQ } from "@freeanima/ui-kit/layout";
import { dismissShellToast, showShellToast, SHELL_TOAST_IDS } from "@freeanima/ui-kit/composite";
import { useEffect, useRef, useState } from "react";

import {
  isBrowserWebShell,
  isStandalonePwa,
  markInstallDismissed,
  readInstallDismissed,
} from "./runtime.ts";

function isCompactInstallContext(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  if (isStandalonePwa()) return true;
  return window.matchMedia(COMPACT_LAYOUT_MQ).matches;
}

/** 开发态清掉同 origin 上遗留的 SW / Cache，避免旧 bundle 劫持 HMR */
async function unregisterDevServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const PWA_UPDATE_CHECK_EVENT = "freeanima:pwa-update-check";

export function requestPwaUpdateCheck(): void {
  window.dispatchEvent(new CustomEvent(PWA_UPDATE_CHECK_EVENT));
}

export function PwaNotices(): null {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => readInstallDismissed());
  const reloadRef = useRef<(() => Promise<void>) | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const webShell = isBrowserWebShell();
  const compactLayout = isCompactInstallContext();

  useEffect(() => {
    if (!webShell) return;

    const cleanups: Array<() => void> = [];
    let cancelled = false;

    if (import.meta.env.PROD) {
      void import("virtual:pwa-register").then(({ registerSW }) => {
        if (cancelled) return;
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            setNeedRefresh(true);
          },
          onOfflineReady() {
            setOfflineReady(true);
          },
          onRegistered(registration) {
            if (registration) registrationRef.current = registration;
          },
        });
        reloadRef.current = updateSW;

        const pollUpdate = () => {
          void registrationRef.current?.update();
        };
        const interval = window.setInterval(pollUpdate, 60 * 60 * 1000);
        const onVis = () => {
          if (document.visibilityState === "visible") pollUpdate();
        };
        const onManual = () => pollUpdate();
        document.addEventListener("visibilitychange", onVis);
        window.addEventListener(PWA_UPDATE_CHECK_EVENT, onManual);
        cleanups.push(() => {
          window.clearInterval(interval);
          document.removeEventListener("visibilitychange", onVis);
          window.removeEventListener(PWA_UPDATE_CHECK_EVENT, onManual);
        });
      });
    } else {
      void unregisterDevServiceWorkers().catch((err) => {
        console.warn("[dev] failed to unregister service workers", err);
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setInstallDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    cleanups.push(() => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    });

    return () => {
      cancelled = true;
      for (const c of cleanups) c();
    };
  }, [webShell]);

  useEffect(() => {
    if (!webShell || !needRefresh) {
      dismissShellToast(SHELL_TOAST_IDS.pwaUpdate);
      return;
    }
    showShellToast(SHELL_TOAST_IDS.pwaUpdate, "有新版本可用。", {
      action: {
        label: "重新加载",
        onClick: () => {
          void reloadRef.current?.();
          setNeedRefresh(false);
        },
      },
    });
  }, [needRefresh, webShell]);

  useEffect(() => {
    if (!webShell || !offlineReady || needRefresh) {
      dismissShellToast(SHELL_TOAST_IDS.pwaOfflineReady);
      return;
    }
    showShellToast(SHELL_TOAST_IDS.pwaOfflineReady, "应用界面已可离线打开；服务数据仍需联网。", {
      duration: 8_000,
      cancel: { label: "关闭", onClick: () => setOfflineReady(false) },
    });
  }, [needRefresh, offlineReady, webShell]);

  const showInstall =
    installEvent != null && !isStandalonePwa() && !installDismissed && compactLayout;

  useEffect(() => {
    if (!webShell || !showInstall || !installEvent) {
      dismissShellToast(SHELL_TOAST_IDS.pwaInstall);
      return;
    }
    showShellToast(SHELL_TOAST_IDS.pwaInstall, "将 FreeAnima 添加到主屏幕，便于快速访问。", {
      action: {
        label: "安装",
        onClick: () => {
          void installEvent.prompt();
          void installEvent.userChoice.then((choice) => {
            if (choice.outcome === "dismissed") {
              markInstallDismissed();
              setInstallDismissed(true);
            }
            setInstallEvent(null);
          });
        },
      },
      cancel: {
        label: "关闭",
        onClick: () => {
          markInstallDismissed();
          setInstallDismissed(true);
          setInstallEvent(null);
        },
      },
    });
  }, [installEvent, showInstall, webShell]);

  return null;
}
