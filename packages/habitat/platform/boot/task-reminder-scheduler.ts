import { logComponent } from "@freeanima/habitat/platform/logging";
import { withRedisLock } from "@freeanima/habitat/core/redis";

import { queryEarliestTaskReminderFireMs, runTaskReminderScan } from "./task-reminder-handler.ts";

const log = logComponent("task-reminder-scheduler");

const MAX_SLEEP_MS = 6 * 60 * 60 * 1000; // 最长睡 6h，避免极端时钟漂移
const MIN_SLEEP_MS = 250;
const REMINDER_LOCK_TTL_MS = 2 * 60 * 1000;

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let running = false;

function clearTimer(): void {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const locked = await withRedisLock(
      { key: "task-reminder-scan", ttlMs: REMINDER_LOCK_TTL_MS, mode: "try" },
      async () => runTaskReminderScan(),
    );
    if (locked.status === "busy") {
      log.debug("task reminder scan skipped: redis lock busy");
      return;
    }
    const output = locked.value;
    try {
      const parsed = JSON.parse(output) as { ok?: boolean; sent?: number };
      if (parsed.ok === true && (parsed.sent ?? 0) > 0) {
        log.debug("task reminder scan fired", { sent: parsed.sent });
      }
    } catch {
      /* ignore */
    }
  } catch (err) {
    log.warn("task reminder scan failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    running = false;
    armNext();
  }
}

function armNext(): void {
  clearTimer();
  if (!started) return;
  void (async () => {
    try {
      const now = Date.now();
      const next = await queryEarliestTaskReminderFireMs(now);
      if (!started) return;
      if (next == null) {
        log.debug("task reminder scheduler idle (no next fire)");
        return;
      }
      const delay = Math.min(MAX_SLEEP_MS, Math.max(MIN_SLEEP_MS, next - now));
      timer = setTimeout(() => {
        void tick();
      }, delay);
    } catch (err) {
      log.warn("task reminder arm failed; retry in 60s", {
        error: err instanceof Error ? err.message : String(err),
      });
      timer = setTimeout(() => {
        void tick();
      }, 60_000);
    }
  })();
}

/** Habitat boot：启动 sleep-until-next（取代每分钟 cron） */
export function startTaskReminderScheduler(): void {
  if (started) return;
  started = true;
  void tick();
}

export function stopTaskReminderScheduler(): void {
  started = false;
  clearTimer();
}

/** 任务/日程 mutation 后重算下一火 */
export function rescheduleTaskReminderScheduler(): void {
  if (!started) return;
  // 扫描进行中：结束时 finally 会 armNext，届时读到最新下一火
  if (running) return;
  clearTimer();
  armNext();
}
