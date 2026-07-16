import { MOBILE_LAYOUT_MQ } from "@freeanima/frontend/ui-kit/layout";
import {
  dismissShellToast,
  showShellToast,
  SHELL_TOAST_IDS,
} from "@freeanima/frontend/ui-kit/composite";
import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

import { m } from "@paraglide/messages";
import {
  isBrowserWebShell,
  isStandalonePwa,
  markInstallDismissed,
  readInstallDismissed,
} from "./runtime.ts";

function isCompactInstallContext(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  if (isStandalonePwa()) return true;
  return window.matchMedia(MOBILE_LAYOUT_MQ).matches;
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

    if (import.meta.env.PROD) {
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
      for (const c of cleanups) c();
    };
  }, [webShell]);

  useEffect(() => {
    if (!webShell || !needRefresh) {
      dismissShellToast(SHELL_TOAST_IDS.pwaUpdate);
      return;
    }
    showShellToast(SHELL_TOAST_IDS.pwaUpdate, m.ui_pwa_update_available(), {
      action: {
        label: m.ui_pwa_update_reload(),
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
    showShellToast(SHELL_TOAST_IDS.pwaOfflineReady, m.ui_pwa_shell_offline_ready(), {
      duration: 8_000,
      cancel: { label: m.ui_common_close(), onClick: () => setOfflineReady(false) },
    });
  }, [needRefresh, offlineReady, webShell]);

  const showInstall =
    installEvent != null && !isStandalonePwa() && !installDismissed && compactLayout;

  useEffect(() => {
    if (!webShell || !showInstall || !installEvent) {
      dismissShellToast(SHELL_TOAST_IDS.pwaInstall);
      return;
    }
    showShellToast(SHELL_TOAST_IDS.pwaInstall, m.ui_pwa_install_prompt(), {
      action: {
        label: m.ui_pwa_install_action(),
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
        label: m.ui_common_close(),
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
