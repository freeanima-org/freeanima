import { getPomodoroSyncSnapshot } from "@freeanima/client/portal-sdk/pomodoro-sync-local.ts";
import { readPomodoroActiveState } from "@freeanima/client/portal-sdk/pomodoro-active.ts";

import { fetchPomodoroConfig } from "./api.ts";
import { runPhaseComplete } from "./pomodoro-sync.ts";
import { remainingMs } from "./timer-engine.ts";

const POLL_MS = 1_000;

/**
 * 轮询本地 active：剩余 ≤0 时自动 `runPhaseComplete`。
 * 主壳与迷你窗各自挂载；跨 WebView 靠 shell sync + runPhaseComplete 内态校验去重。
 */
export function bindPomodoroPhaseCompleteTick(subjectId: number): () => void {
  let completing = false;
  const id = window.setInterval(() => {
    void (async () => {
      if (completing) return;
      const active =
        getPomodoroSyncSnapshot(subjectId).active ?? readPomodoroActiveState(undefined, subjectId);
      if (!active || active.runState !== "running") return;
      if (remainingMs(active) > 0) return;
      completing = true;
      try {
        const config = await fetchPomodoroConfig(subjectId);
        await runPhaseComplete({ state: active, config, subjectId });
      } catch {
        /* 下次 tick 重试 */
      } finally {
        completing = false;
      }
    })();
  }, POLL_MS);
  return () => clearInterval(id);
}
