import {
  isSwitchableChannel,
  resolveNativePackagedKind,
  resolvePackagedUpdate,
  type PackagedUpdateResult,
  type UpdateTrack,
} from "@freeanima/client/portal-sdk/app-update";
import type { BuildChannel } from "@freeanima/client/portal-sdk/build-meta";
import { readGithubReleaseProxyPref } from "@freeanima/client/portal-sdk/github-release-proxy-prefs";
import { resolveAboutNativeBuildMeta } from "@freeanima/client/portal-sdk/native-build-meta.resolve";
import { dismissShellToast, showShellToast, SHELL_TOAST_IDS } from "@freeanima/ui-kit/composite";
import { useEffect, useRef, useState } from "react";

import { m } from "@paraglide/messages";
const DISMISS_KEY = "freeanima.shell-update.dismissed-key";

function dismissKey(update: Extract<PackagedUpdateResult, { available: true }>): string {
  return `${update.track}:${update.remoteVersion}:${update.remoteCommit ?? ""}`;
}

function readDismissedKey(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissedKey(key: string): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, key);
  } catch {
    /* ignore */
  }
}

function formatUpdateErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const detail = m.ui_shell_update_failed_detail({ message });
  if (typeof window.portalShell?.applyPackagedUpdate === "function") {
    return `${detail} ${m.ui_shell_update_log_hint()}`;
  }
  return detail;
}

function formatProgressBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${Math.floor(n)} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

type ApplyProgress = {
  received: number;
  total: number | null;
  phase: "downloading" | "installing";
};

function formatApplyingMessage(progress: ApplyProgress | null): string {
  if (progress?.phase === "installing") {
    return m.ui_shell_update_installing();
  }
  if (!progress) {
    return m.ui_shell_update_applying();
  }
  if (progress.total != null && progress.total > 0) {
    const percent = Math.min(100, Math.floor((100 * progress.received) / progress.total));
    return m.ui_shell_update_downloading({ percent: String(percent) });
  }
  return m.ui_shell_update_downloading_bytes({ bytes: formatProgressBytes(progress.received) });
}

export const SHELL_UPDATE_CHECK_EVENT = "freeanima:shell-update-check";

export type ShellUpdateRequestDetail = {
  intent?: "check" | "switch";
  targetChannel?: UpdateTrack;
};

export function requestShellUpdateCheck(detail?: ShellUpdateRequestDetail): void {
  window.dispatchEvent(new CustomEvent(SHELL_UPDATE_CHECK_EVENT, { detail }));
}

type Phase = "idle" | "checking" | "available" | "applying" | "failed" | "latest" | "none";

export function ShellUpdateBanner(): null {
  const kind = resolveNativePackagedKind();
  const [phase, setPhase] = useState<Phase>("idle");
  const [update, setUpdate] = useState<Extract<PackagedUpdateResult, { available: true }> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [applyProgress, setApplyProgress] = useState<ApplyProgress | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!kind) return;

    const runCheck = async (manual: boolean, detail?: ShellUpdateRequestDetail) => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      if (manual) setPhase("checking");
      try {
        const meta = await resolveAboutNativeBuildMeta();
        const channel: BuildChannel =
          meta?.channel ?? window.portalShell?.nativeBuild?.channel ?? "local";
        if (!isSwitchableChannel(channel)) {
          if (manual) setPhase("none");
          else setPhase("idle");
          setUpdate(null);
          return;
        }
        const local = meta?.version ?? window.portalShell?.nativeBuild?.version ?? "0.0.0";
        const localCommit = meta?.git?.commit_full ?? meta?.git?.commit;
        const intent = detail?.intent ?? "check";
        const targetChannel = detail?.targetChannel;
        setSwitching(intent === "switch");
        const result = await resolvePackagedUpdate({
          kind,
          localVersion: local,
          channel,
          ...(localCommit ? { localCommit } : {}),
          intent,
          ...(targetChannel ? { targetChannel } : {}),
          proxy: readGithubReleaseProxyPref(),
        });
        if (!result.available) {
          if (manual) {
            setPhase(
              result.reason === "no_asset" || result.reason === "unsupported_channel"
                ? "none"
                : "latest",
            );
          } else {
            setPhase("idle");
          }
          setUpdate(null);
          return;
        }
        if (!manual && readDismissedKey() === dismissKey(result)) {
          setPhase("idle");
          setUpdate(null);
          return;
        }
        setUpdate(result);
        setPhase("available");
        setError(null);
      } catch (err) {
        if (manual) {
          setPhase("failed");
          setError(formatUpdateErrorMessage(err));
        }
      } finally {
        checkingRef.current = false;
      }
    };

    void runCheck(false);
    const onVis = () => {
      if (document.visibilityState === "visible") void runCheck(false);
    };
    const onManual = (ev: Event) => {
      const detail = (ev as CustomEvent<ShellUpdateRequestDetail>).detail;
      void runCheck(true, detail);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(SHELL_UPDATE_CHECK_EVENT, onManual);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(SHELL_UPDATE_CHECK_EVENT, onManual);
    };
  }, [kind]);

  useEffect(() => {
    if (!kind) {
      dismissShellToast(SHELL_TOAST_IDS.shellUpdate);
      return;
    }

    if (phase === "idle" || phase === "checking") {
      if (phase === "checking") {
        showShellToast(SHELL_TOAST_IDS.shellUpdate, `${m.ui_shell_update_check()}…`, {
          duration: 10_000,
        });
      } else {
        dismissShellToast(SHELL_TOAST_IDS.shellUpdate);
      }
      return;
    }

    if (phase === "latest" || phase === "none") {
      showShellToast(
        SHELL_TOAST_IDS.shellUpdate,
        phase === "none" ? m.ui_shell_update_none() : m.ui_shell_update_latest(),
        {
          duration: 8_000,
          cancel: { label: m.ui_common_close(), onClick: () => setPhase("idle") },
        },
      );
      return;
    }

    if (phase === "failed") {
      showShellToast(SHELL_TOAST_IDS.shellUpdate, error ?? m.ui_shell_update_failed(), {
        duration: Number.POSITIVE_INFINITY,
        cancel: { label: m.ui_common_close(), onClick: () => setPhase("idle") },
      });
      return;
    }

    if (phase === "applying") {
      showShellToast(SHELL_TOAST_IDS.shellUpdate, formatApplyingMessage(applyProgress), {
        duration: Number.POSITIVE_INFINITY,
      });
      return;
    }

    if (!update) {
      dismissShellToast(SHELL_TOAST_IDS.shellUpdate);
      return;
    }

    const title = switching
      ? m.ui_shell_channel_switch_available({
          channel: update.track,
          version: update.remoteVersion,
        })
      : m.ui_shell_update_available({ version: update.remoteVersion });

    showShellToast(SHELL_TOAST_IDS.shellUpdate, title, {
      action: {
        label: switching ? m.ui_shell_channel_switch_install() : m.ui_shell_update_install(),
        onClick: () => {
          const apply = window.portalShell?.applyPackagedUpdate;
          if (!apply) {
            setPhase("failed");
            setError(m.ui_shell_update_failed());
            return;
          }
          setApplyProgress({
            received: 0,
            total: update.assetSize ?? null,
            phase: "downloading",
          });
          setPhase("applying");
          const unsub = window.portalShell?.onPackagedUpdateProgress?.((progress) => {
            setApplyProgress({
              received: progress.received,
              total: progress.total ?? update.assetSize ?? null,
              phase: progress.phase ?? "downloading",
            });
          });
          void apply({
            assetUrl: update.assetUrl,
            ...(update.assetSize != null ? { expectedSize: update.assetSize } : {}),
          })
            .catch((err) => {
              setPhase("failed");
              setError(formatUpdateErrorMessage(err));
            })
            .finally(() => {
              unsub?.();
            });
        },
      },
      cancel: {
        label: m.ui_shell_update_dismiss(),
        onClick: () => {
          writeDismissedKey(dismissKey(update));
          setPhase("idle");
          setUpdate(null);
        },
      },
    });
  }, [applyProgress, error, kind, phase, switching, update]);

  return null;
}
