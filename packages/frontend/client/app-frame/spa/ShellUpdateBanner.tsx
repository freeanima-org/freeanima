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
import { getShellBuildTarget } from "@freeanima/client/portal-sdk/shell-build-target";
import { dismissShellToast, showShellToast, SHELL_TOAST_IDS } from "@freeanima/ui-kit/composite";
import { isRecord } from "@freeanima/shared/util";
import { useEffect, useRef, useState } from "react";

import { formatApplyingMessage, type ShellApplyProgress } from "./shell-update-progress.ts";

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
  const detail = `更新失败：${message}`;
  if (
    getShellBuildTarget() === "desktop" &&
    typeof window.portalShell?.applyPackagedUpdate === "function"
  ) {
    return `${detail} 详情见 ~/.anima/desktop-shell/shell.log。`;
  }
  return detail;
}

export const SHELL_UPDATE_CHECK_EVENT = "freeanima:shell-update-check";

export type ShellUpdateRequestDetail = {
  intent?: "check" | "switch";
  targetChannel?: UpdateTrack;
};

function readShellUpdateDetail(ev: CustomEvent): ShellUpdateRequestDetail | undefined {
  const detail: unknown = ev.detail;
  if (!isRecord(detail)) return undefined;
  const out: ShellUpdateRequestDetail = {};
  if (detail.intent === "check" || detail.intent === "switch") out.intent = detail.intent;
  if (detail.targetChannel === "release" || detail.targetChannel === "canary") {
    out.targetChannel = detail.targetChannel;
  }
  return out;
}

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
  const [applyProgress, setApplyProgress] = useState<ShellApplyProgress | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!kind) return () => {};

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
      if (!(ev instanceof CustomEvent)) return;
      void runCheck(true, readShellUpdateDetail(ev));
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
        showShellToast(SHELL_TOAST_IDS.shellUpdate, `检查更新…`, {
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
        phase === "none" ? "尚无适用于此平台的更新包。" : "已是最新版本。",
        {
          duration: 8_000,
          cancel: { label: "关闭", onClick: () => setPhase("idle") },
        },
      );
      return;
    }

    if (phase === "failed") {
      showShellToast(SHELL_TOAST_IDS.shellUpdate, error ?? "更新失败。请重试。", {
        duration: Number.POSITIVE_INFINITY,
        cancel: { label: "关闭", onClick: () => setPhase("idle") },
      });
      return;
    }

    if (phase === "applying") {
      showShellToast(SHELL_TOAST_IDS.shellUpdate, formatApplyingMessage(applyProgress), {
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
      });
      return;
    }

    if (!update) {
      dismissShellToast(SHELL_TOAST_IDS.shellUpdate);
      return;
    }

    const title = switching
      ? `安装 ${update.track} 构建（${update.remoteVersion}）？`
      : `有新的应用版本（${update.remoteVersion}）可用。`;

    showShellToast(SHELL_TOAST_IDS.shellUpdate, title, {
      action: {
        label: switching ? "切换通道" : "立即更新",
        onClick: (event) => {
          // 阻止 Sonner action 后自动 dismiss，否则进度 toast 与卸载动画竞态消失
          event?.preventDefault?.();
          const apply = window.portalShell?.applyPackagedUpdate;
          if (!apply) {
            setPhase("failed");
            setError("更新失败。请重试。");
            return;
          }
          setApplyProgress({
            received: 0,
            total: update.assetSize ?? null,
            phase: "downloading",
          });
          setPhase("applying");
          void (async () => {
            const maybeUnsub = window.portalShell?.onPackagedUpdateProgress?.((progress) => {
              setApplyProgress({
                received: progress.received,
                total: progress.total ?? update.assetSize ?? null,
                phase: progress.phase ?? "downloading",
              });
            });
            const unsub = maybeUnsub != null ? await Promise.resolve(maybeUnsub) : undefined;
            try {
              await apply({
                assetUrl: update.assetUrl,
                ...(update.assetSize != null ? { expectedSize: update.assetSize } : {}),
              });
            } catch (err) {
              setPhase("failed");
              setError(formatUpdateErrorMessage(err));
            } finally {
              unsub?.();
            }
          })();
        },
      },
      cancel: {
        label: "稍后",
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
