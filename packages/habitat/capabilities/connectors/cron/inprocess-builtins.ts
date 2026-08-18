import { deleteCronJob } from "@freeanima/habitat/core/db/pg/cron";
import { withRedisLock } from "@freeanima/habitat/core/redis";
import { logComponent } from "@freeanima/habitat/platform/logging";
import { notifyInprocessBuiltinFailure } from "@freeanima/habitat/platform/ports/cron-notify";

import { resolveBunSchedule } from "./bun-schedule.ts";
import { runCronBuiltinHandler } from "./builtin-handlers.ts";

export type InprocessBuiltinDef = {
  id: string;
  name: string;
  /** 与历史 cron_jobs.schedule 相同语义（CST 墙钟小时会经 resolveBunSchedule 转 UTC） */
  schedule: string;
};

/** 与手动 memoryMaintenance API 共享的分布式锁逻辑名 */
export const MEMORY_MAINTENANCE_LOCK_KEY = "memory-maintenance";
/** 记忆维护租约；杀进程后卡死上限 ≈ 此时效（活任务靠 renew 续期） */
export const MEMORY_MAINTENANCE_LOCK_TTL_MS = 30 * 60 * 1000;
/** @deprecated 使用 MEMORY_MAINTENANCE_LOCK_KEY */
export const SLEEP_PIPELINE_LOCK_KEY = MEMORY_MAINTENANCE_LOCK_KEY;

const MIN_MS = 60 * 1000;

function inprocessLockOpts(id: string): {
  key: string;
  ttlMs: number;
  renew?: boolean;
  mode: "try";
} {
  if (id === "builtin-memory-maintenance") {
    return {
      key: MEMORY_MAINTENANCE_LOCK_KEY,
      ttlMs: MEMORY_MAINTENANCE_LOCK_TTL_MS,
      renew: true,
      mode: "try",
    };
  }
  if (id === "builtin-temporal-summary-tick") {
    return { key: `inprocess:${id}`, ttlMs: 10 * MIN_MS, renew: true, mode: "try" };
  }
  if (id === "builtin-email-sync-all" || id === "builtin-env-health") {
    return { key: `inprocess:${id}`, ttlMs: 4 * MIN_MS, mode: "try" };
  }
  return { key: `inprocess:${id}`, ttlMs: 10 * MIN_MS, mode: "try" };
}

/** 进程内 Bun.cron：不写 cron_jobs / cron_log */
export const INPROCESS_BUILTIN_DEFS: readonly InprocessBuiltinDef[] = [
  { id: "builtin-memory-maintenance", name: "memory-maintenance", schedule: "0 2 * * *" },
  // task-reminders 已迁 sleep-until-next（task-reminder-scheduler）；保留 handler 供测试手动 fire
  { id: "builtin-env-health", name: "env-health", schedule: "*/5 * * * *" },
  { id: "builtin-email-sync-all", name: "email-sync-all", schedule: "*/5 * * * *" },
  {
    id: "builtin-temporal-summary-tick",
    name: "temporal-summary-tick",
    schedule: "*/30 * * * *",
  },
] as const;

const INPROCESS_IDS = new Set<string>(INPROCESS_BUILTIN_DEFS.map((d) => d.id));

export type InprocessBuiltinRuntime = {
  id: string;
  name: string;
  schedule: string;
  paused: boolean;
  run_count: number;
  /** unix seconds；0 = 尚未跑过 */
  last_run_at: number;
  last_ok: boolean | null;
};

type Handle = { stop(): void };

const handles = new Map<string, Handle>();
const states = new Map<string, InprocessBuiltinRuntime>();
let started = false;

export function isInprocessBuiltinId(id: string): boolean {
  return INPROCESS_IDS.has(id);
}

export function listInprocessBuiltinStatuses(): InprocessBuiltinRuntime[] {
  return INPROCESS_BUILTIN_DEFS.map((def) => {
    const st = states.get(def.id);
    return (
      st ?? {
        id: def.id,
        name: def.name,
        schedule: def.schedule,
        paused: false,
        run_count: 0,
        last_run_at: 0,
        last_ok: null,
      }
    );
  });
}

export function getInprocessBuiltinStatus(id: string): InprocessBuiltinRuntime | null {
  if (!INPROCESS_IDS.has(id)) return null;
  return listInprocessBuiltinStatuses().find((s) => s.id === id) ?? null;
}

function shouldLogSuccessOutput(_id: string, output: string): boolean {
  return output.trim().length > 0;
}

/** handler 输出 `{ ok: false }` 或抛错均视为失败（无 cron_log，须 Inbox 双收件） */
export function extractInprocessFailureMessage(output: string | null): string | null {
  if (output == null) return "builtin handler not registered";
  try {
    const parsed = JSON.parse(output) as {
      ok?: boolean;
      error?: string;
      summary?: string;
    };
    if (parsed && typeof parsed === "object" && parsed.ok === false) {
      const detail = parsed.error ?? parsed.summary ?? output;
      return detail.slice(0, 4000);
    }
  } catch {
    /* 非 JSON 视为成功输出 */
  }
  return null;
}

async function reportFailure(state: InprocessBuiltinRuntime, error: string): Promise<void> {
  state.last_ok = false;
  logComponent("cron-inprocess").warn(`${state.id} failed`, {
    err: error,
    job_id: state.id,
  });
  try {
    await notifyInprocessBuiltinFailure({
      id: state.id,
      name: state.name,
      error,
      run_count: state.run_count,
    });
  } catch (notifyErr) {
    logComponent("cron-inprocess").warn(`${state.id} failure notify failed`, {
      err: notifyErr,
      job_id: state.id,
    });
  }
}

async function fire(id: string): Promise<void> {
  const log = logComponent("cron-inprocess");
  const state = states.get(id);
  if (!state || state.paused) return;

  const locked = await withRedisLock(inprocessLockOpts(id), async () => {
    state.run_count += 1;
    state.last_run_at = Date.now() / 1000;

    try {
      const output = await runCronBuiltinHandler(id);
      const failure = extractInprocessFailureMessage(output);
      if (failure != null) {
        await reportFailure(state, failure);
        return;
      }
      state.last_ok = true;
      if (output != null && shouldLogSuccessOutput(id, output)) {
        log.debug(`${id} ok`, { output: output.slice(0, 240) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await reportFailure(state, message.slice(0, 4000));
    }
  });

  if (locked.status === "busy") {
    log.debug(`${id} skipped: redis lock busy`, { job_id: id });
  }
}

/** Habitat boot：挂 Bun.cron；可重复调用（幂等） */
export function startInprocessBuiltins(): void {
  if (started) return;
  started = true;
  const log = logComponent("cron-inprocess");

  for (const def of INPROCESS_BUILTIN_DEFS) {
    states.set(def.id, {
      id: def.id,
      name: def.name,
      schedule: def.schedule,
      paused: false,
      run_count: 0,
      last_run_at: 0,
      last_ok: null,
    });

    const resolved = resolveBunSchedule(def.schedule);
    if (resolved.kind !== "cron") {
      throw new Error(`inprocess builtin ${def.id} requires recurring cron schedule`);
    }

    const handle = Bun.cron(resolved.expr, () => {
      void fire(def.id);
    });
    handles.set(def.id, handle);
    log.info(`inprocess builtin armed: ${def.id}`, {
      schedule: def.schedule,
      bun_expr: resolved.expr,
    });
  }
}

export function stopInprocessBuiltins(): void {
  for (const handle of handles.values()) {
    handle.stop();
  }
  handles.clear();
  states.clear();
  started = false;
}

/** 删除历史上 upsert 进 PG 的同名 builtin 行（幂等） */
export async function purgeInprocessBuiltinRowsFromPg(): Promise<number> {
  let removed = 0;
  for (const def of INPROCESS_BUILTIN_DEFS) {
    const ok = await deleteCronJob(def.id);
    if (ok) removed += 1;
  }
  // 已迁 sleep-until-next 的旧分钟 cron 行；旧 sleep-cycle 行
  if (await deleteCronJob("builtin-task-reminders")) removed += 1;
  if (await deleteCronJob("builtin-sleep-cycle")) removed += 1;
  return removed;
}

/** @internal — 单测直接触发一次 fire */
export async function fireInprocessBuiltinForTest(id: string): Promise<void> {
  await fire(id);
}

/** @internal */
export function resetInprocessBuiltinsForTest(): void {
  stopInprocessBuiltins();
}
