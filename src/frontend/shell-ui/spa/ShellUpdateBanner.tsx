import { Button } from "@freeanima/frontend/ui-kit";
import { StatusAlert } from "@freeanima/frontend/ui-kit/composite";
import {
  resolveNativePackagedKind,
  resolvePackagedUpdate,
  type PackagedUpdateResult,
} from "@freeanima/frontend/shell-sdk/app-update";
import { resolveAboutNativeBuildMeta } from "@freeanima/frontend/shell-sdk/native-build-meta.resolve";
import { useEffect, useRef, useState, type JSX } from "react";

import { m } from "@paraglide/messages";

const DISMISS_KEY = "freeanima.shell-update.dismissed-version";

function readDismissedVersion(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissedVersion(version: string): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, version);
  } catch {
    /* ignore */
  }
}

export const SHELL_UPDATE_CHECK_EVENT = "freeanima:shell-update-check";

export function requestShellUpdateCheck(): void {
  window.dispatchEvent(new CustomEvent(SHELL_UPDATE_CHECK_EVENT));
}

type Phase = "idle" | "checking" | "available" | "applying" | "failed" | "latest" | "none";

export function ShellUpdateBanner(): JSX.Element | null {
  const kind = resolveNativePackagedKind();
  const [phase, setPhase] = useState<Phase>("idle");
  const [update, setUpdate] = useState<Extract<PackagedUpdateResult, { available: true }> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!kind) return;

    const runCheck = async (manual: boolean) => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      if (manual) setPhase("checking");
      try {
        const meta = await resolveAboutNativeBuildMeta();
        const local = meta?.version ?? window.satelliteShell?.nativeBuild?.version ?? "0.0.0";
        const result = await resolvePackagedUpdate({ kind, localVersion: local });
        if (!result.available) {
          if (manual) {
            setPhase(result.reason === "no_asset" ? "none" : "latest");
          } else {
            setPhase("idle");
          }
          setUpdate(null);
          return;
        }
        if (!manual && readDismissedVersion() === result.remoteVersion) {
          setPhase("idle");
          setUpdate(null);
          return;
        }
        setUpdate(result);
        setPhase("available");
        setError(null);
      } catch {
        if (manual) {
          setPhase("failed");
          setError(m.ui_shell_update_failed());
        }
      } finally {
        checkingRef.current = false;
      }
    };

    void runCheck(false);
    const onVis = () => {
      if (document.visibilityState === "visible") void runCheck(false);
    };
    const onManual = () => void runCheck(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(SHELL_UPDATE_CHECK_EVENT, onManual);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(SHELL_UPDATE_CHECK_EVENT, onManual);
    };
  }, [kind]);

  if (!kind) return null;
  if (phase === "idle" || phase === "checking") {
    if (phase === "checking") {
      return (
        <div className="shrink-0 border-b border-border px-4 py-2">
          <StatusAlert variant="info">{m.ui_shell_update_check()}…</StatusAlert>
        </div>
      );
    }
    return null;
  }

  if (phase === "latest" || phase === "none") {
    return (
      <div className="shrink-0 border-b border-border px-4 py-2">
        <StatusAlert variant="info" className="flex flex-wrap items-center justify-between gap-2">
          <span>{phase === "none" ? m.ui_shell_update_none() : m.ui_shell_update_latest()}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPhase("idle")}>
            {m.ui_common_close()}
          </Button>
        </StatusAlert>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="shrink-0 border-b border-border px-4 py-2">
        <StatusAlert
          variant="warning"
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <span>{error ?? m.ui_shell_update_failed()}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPhase("idle")}>
            {m.ui_common_close()}
          </Button>
        </StatusAlert>
      </div>
    );
  }

  if (phase === "applying") {
    return (
      <div className="shrink-0 border-b border-border px-4 py-2">
        <StatusAlert variant="info">{m.ui_shell_update_applying()}</StatusAlert>
      </div>
    );
  }

  if (!update) return null;

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      <StatusAlert variant="info" className="flex flex-wrap items-center justify-between gap-2">
        <span>{m.ui_shell_update_available({ version: update.remoteVersion })}</span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const apply = window.satelliteShell?.applyPackagedUpdate;
              if (!apply) {
                setPhase("failed");
                setError(m.ui_shell_update_failed());
                return;
              }
              setPhase("applying");
              void apply({ assetUrl: update.assetUrl }).catch(() => {
                setPhase("failed");
                setError(m.ui_shell_update_failed());
              });
            }}
          >
            {m.ui_shell_update_install()}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              writeDismissedVersion(update.remoteVersion);
              setPhase("idle");
              setUpdate(null);
            }}
          >
            {m.ui_shell_update_dismiss()}
          </Button>
        </div>
      </StatusAlert>
    </div>
  );
}
