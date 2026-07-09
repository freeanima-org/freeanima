import { MOBILE_LAYOUT_MQ } from "@freeanima/frontend/ui-kit/layout";
import { useEffect, useRef, useState, type JSX } from "react";
import { Button } from "@freeanima/frontend/ui-kit";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
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

export function PwaNotices(): JSX.Element | null {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => readInstallDismissed());
  const reloadRef = useRef<(() => Promise<void>) | null>(null);

  const webShell = isBrowserWebShell();
  const compactLayout = isCompactInstallContext();

  useEffect(() => {
    if (!webShell) return;

    if (import.meta.env.PROD) {
      const updateSW = registerSW({
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onOfflineReady() {
          setOfflineReady(true);
        },
      });
      reloadRef.current = updateSW;
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
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [webShell]);

  if (!webShell) return null;

  const showInstall =
    installEvent != null && !isStandalonePwa() && !installDismissed && compactLayout;

  if (!needRefresh && !offlineReady && !showInstall) return null;

  return (
    <div className="shrink-0 flex flex-col gap-2 border-b border-border px-4 py-2">
      {needRefresh ? (
        <StatusAlert variant="info" className="flex flex-wrap items-center justify-between gap-2">
          <span>{m.ui_pwa_update_available()}</span>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void reloadRef.current?.();
              setNeedRefresh(false);
            }}
          >
            {m.ui_pwa_update_reload()}
          </Button>
        </StatusAlert>
      ) : null}
      {offlineReady && !needRefresh ? (
        <StatusAlert variant="info" className="flex flex-wrap items-center justify-between gap-2">
          <span>{m.ui_pwa_shell_offline_ready()}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOfflineReady(false)}>
            {m.ui_common_close()}
          </Button>
        </StatusAlert>
      ) : null}
      {showInstall ? (
        <StatusAlert variant="info" className="flex flex-wrap items-center justify-between gap-2">
          <span>{m.ui_pwa_install_prompt()}</span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void installEvent?.prompt();
                void installEvent?.userChoice.then((choice) => {
                  if (choice.outcome === "dismissed") {
                    markInstallDismissed();
                    setInstallDismissed(true);
                  }
                  setInstallEvent(null);
                });
              }}
            >
              {m.ui_pwa_install_action()}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                markInstallDismissed();
                setInstallDismissed(true);
                setInstallEvent(null);
              }}
            >
              {m.ui_common_close()}
            </Button>
          </div>
        </StatusAlert>
      ) : null}
    </div>
  );
}
