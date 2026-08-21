import {
  applyLocalPomodoroActive,
  type PomodoroSyncMeta,
} from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import type { PomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active-types.ts";
import { isRecord } from "@freeanima/shared/util";

function isPomodoroActiveState(value: unknown): value is PomodoroActiveState {
  if (!isRecord(value)) return false;
  return (
    (value.phase === "work" || value.phase === "short_break" || value.phase === "long_break") &&
    (value.runState === "running" || value.runState === "paused") &&
    typeof value.phasePlannedMs === "number" &&
    typeof value.sessionLocalId === "string"
  );
}

function isSyncMeta(value: unknown): value is PomodoroSyncMeta {
  if (!isRecord(value)) return false;
  return typeof value.device_id === "string" && typeof value.updated_at_ms === "number";
}

/**
 * 订阅壳层 `pomodoro:active-sync`（主窗 ↔ 迷你窗）。
 * 收到后写入本 WebView 本地态，且不再二次 broadcast（避免环）。
 */
export function bindPomodoroShellActiveSync(subjectId: number): () => void {
  const shell = typeof window !== "undefined" ? window.portalShell : undefined;
  if (!shell?.listenPomodoroActiveSync) return () => {};
  return shell.listenPomodoroActiveSync((payload) => {
    if (payload.subject_id !== subjectId) return;
    const active =
      payload.active == null ? null : isPomodoroActiveState(payload.active) ? payload.active : null;
    if (payload.active != null && active == null) return;
    const meta = payload.meta != null && isSyncMeta(payload.meta) ? payload.meta : null;
    applyLocalPomodoroActive(active, subjectId, meta, { broadcastShell: false });
  });
}
