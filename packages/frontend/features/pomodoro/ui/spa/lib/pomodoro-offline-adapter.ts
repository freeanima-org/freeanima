import { readOfflineCache, writeOfflineCache } from "@freeanima/client/portal-sdk/offline-cache";
import { getModulePendingCount } from "@freeanima/client/portal-sdk/offline-module-cap";
import {
  registerOfflineModule,
  registerOfflineModuleCap,
} from "@freeanima/client/portal-sdk/offline-module-registry";
import type { RpcModuleAdapter } from "@freeanima/client/portal-sdk/offline-module-types";
import {
  resolveOutboxScope,
  type OfflineOutboxOp,
} from "@freeanima/client/portal-sdk/offline-outbox";
import { flushOfflineModule } from "@freeanima/client/portal-sdk/offline-sync";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { getUserSubjectId } from "@freeanima/client/portal-sdk/world-context.ts";

import { POMODORO_OUTBOX_MODULE_ID } from "./pomodoro-offline-store.ts";

const POMODORO_FLUSH_METHODS = [
  "pomodoro.config.update",
  "pomodoro.active.put",
  "pomodoro.active.clear",
] as const;
type PomodoroFlushMethod = (typeof POMODORO_FLUSH_METHODS)[number];

function isPomodoroFlushMethod(v: string): v is PomodoroFlushMethod {
  return (POMODORO_FLUSH_METHODS as readonly string[]).includes(v);
}

function isPositiveSubjectId(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

const NAMESPACE = "pomodoro";
const COMPACT_METHODS = new Set([
  "pomodoro.config.update",
  "pomodoro.active.put",
  "pomodoro.active.clear",
]);

function configCacheId(subjectId: number): string {
  return `config:${subjectId}`;
}

function sessionsCacheId(subjectId: number): string {
  return `sessions:${subjectId}`;
}

function statsCacheId(subjectId: number, period: "today" | "week"): string {
  return `stats:${subjectId}:${period}`;
}

export function compactPomodoroOutbox(ops: OfflineOutboxOp[]): OfflineOutboxOp[] {
  const latestByMethod = new Map<string, OfflineOutboxOp>();
  const rest: OfflineOutboxOp[] = [];
  for (const op of ops) {
    if (COMPACT_METHODS.has(op.method)) {
      latestByMethod.set(op.method, op);
    } else {
      rest.push(op);
    }
  }
  return [...latestByMethod.values(), ...rest].toSorted((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

async function flushPomodoroOp(
  op: OfflineOutboxOp,
  _scope: string,
): Promise<import("@freeanima/client/portal-sdk/offline-module-types").FlushOpOutcome> {
  const habitatClient = getTypedHabitatClient();
  try {
    if (!isPomodoroFlushMethod(op.method)) {
      return { status: "failed", error: `unknown method ${op.method}` };
    }
    const subjectId = op.payload.subject_id;
    if (!isPositiveSubjectId(subjectId)) {
      return { status: "failed", error: "invalid subject_id" };
    }
    await habitatClient.call(op.method, {
      ...op.payload,
      subject_id: subjectId,
    });
    return { status: "done" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", error: message };
  }
}

export const pomodoroRpcAdapter: RpcModuleAdapter = {
  kind: "rpc",
  moduleId: POMODORO_OUTBOX_MODULE_ID,
  ordering: "fifo",
  compactOutbox: compactPomodoroOutbox,
  flushOp: async (op, ctx) => flushPomodoroOp(op, ctx.scope),
  refreshAll: async (scope) => {
    const habitatClient = getTypedHabitatClient();
    let subjectId: number;
    try {
      subjectId = await getUserSubjectId();
    } catch {
      return;
    }
    try {
      const [configData, sessions, statsToday, statsWeek] = await Promise.all([
        habitatClient.call("pomodoro.config.get", { subject_id: subjectId }),
        habitatClient.call("pomodoro.session.list", {
          subject_id: subjectId,
          limit: 20,
          offset: 0,
        }),
        habitatClient.call("pomodoro.session.stats", {
          subject_id: subjectId,
          period: "today",
        }),
        habitatClient.call("pomodoro.session.stats", {
          subject_id: subjectId,
          period: "week",
        }),
      ]);
      await writeOfflineCache(scope, NAMESPACE, configCacheId(subjectId), configData.config);
      await writeOfflineCache(scope, NAMESPACE, sessionsCacheId(subjectId), sessions);
      await writeOfflineCache(scope, NAMESPACE, statsCacheId(subjectId, "today"), statsToday);
      await writeOfflineCache(scope, NAMESPACE, statsCacheId(subjectId, "week"), statsWeek);
    } catch {
      /* keep snapshot */
    }
  },
};

export function registerPomodoroOfflineModule(): void {
  registerOfflineModule(pomodoroRpcAdapter);
  registerOfflineModuleCap(POMODORO_OUTBOX_MODULE_ID, { offlineWritable: true });
}

export function schedulePomodoroFlush(): void {
  void flushOfflineModule(POMODORO_OUTBOX_MODULE_ID, resolveOutboxScope()).catch(() => {});
}

export async function readCachedPomodoroConfig(scope: string, subjectId: number) {
  return readOfflineCache(scope, NAMESPACE, configCacheId(subjectId));
}

export async function readCachedPomodoroSessions(scope: string, subjectId: number) {
  return readOfflineCache<{ items: unknown[]; total: number }>(
    scope,
    NAMESPACE,
    sessionsCacheId(subjectId),
  );
}

export async function readCachedPomodoroStats(
  scope: string,
  subjectId: number,
  period: "today" | "week",
) {
  return readOfflineCache(scope, NAMESPACE, statsCacheId(subjectId, period));
}

export async function countPomodoroPendingOps(): Promise<number> {
  return getModulePendingCount(resolveOutboxScope(), POMODORO_OUTBOX_MODULE_ID);
}
