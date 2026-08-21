import { readOfflineCache, writeOfflineCache } from "@freeanima/client/portal-sdk/offline-cache";
import {
  registerOfflineModule,
  registerOfflineModuleCap,
} from "@freeanima/client/portal-sdk/offline-module-registry";
import type { RpcModuleAdapter } from "@freeanima/client/portal-sdk/offline-module-types";
import {
  listOutboxOps,
  resolveOutboxScope,
  type OfflineOutboxOp,
} from "@freeanima/client/portal-sdk/offline-outbox";
import { flushOfflineModule } from "@freeanima/client/portal-sdk/offline-sync";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import { POMODORO_OUTBOX_MODULE_ID } from "./pomodoro-offline-store.ts";

type PomodoroSubjectKind = "user" | "agent";

const POMODORO_FLUSH_METHODS = [
  "pomodoro.config.update",
  "pomodoro.active.put",
  "pomodoro.active.clear",
] as const;
type PomodoroFlushMethod = (typeof POMODORO_FLUSH_METHODS)[number];

function isPomodoroFlushMethod(v: string): v is PomodoroFlushMethod {
  return (POMODORO_FLUSH_METHODS as readonly string[]).includes(v);
}

function isPomodoroSubjectKind(v: unknown): v is PomodoroSubjectKind {
  return v === "user" || v === "agent";
}

const NAMESPACE = "pomodoro";
const COMPACT_METHODS = new Set([
  "pomodoro.config.update",
  "pomodoro.active.put",
  "pomodoro.active.clear",
]);

function configCacheId(subjectKind: PomodoroSubjectKind): string {
  return `config:${subjectKind}`;
}

function sessionsCacheId(subjectKind: PomodoroSubjectKind): string {
  return `sessions:${subjectKind}`;
}

function statsCacheId(subjectKind: PomodoroSubjectKind, period: "today" | "week"): string {
  return `stats:${subjectKind}:${period}`;
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
    const subjectKind = op.payload.subject_kind;
    if (!isPomodoroSubjectKind(subjectKind)) {
      return { status: "failed", error: "invalid subject_kind" };
    }
    await habitatClient.call(op.method, {
      ...op.payload,
      subject_kind: subjectKind,
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
    for (const subjectKind of ["user", "agent"] as const) {
      try {
        const [configData, sessions, statsToday, statsWeek] = await Promise.all([
          habitatClient.call("pomodoro.config.get", { subject_kind: subjectKind }),
          habitatClient.call("pomodoro.session.list", {
            subject_kind: subjectKind,
            limit: 20,
            offset: 0,
          }),
          habitatClient.call("pomodoro.session.stats", {
            subject_kind: subjectKind,
            period: "today",
          }),
          habitatClient.call("pomodoro.session.stats", {
            subject_kind: subjectKind,
            period: "week",
          }),
        ]);
        await writeOfflineCache(scope, NAMESPACE, configCacheId(subjectKind), configData.config);
        await writeOfflineCache(scope, NAMESPACE, sessionsCacheId(subjectKind), sessions);
        await writeOfflineCache(scope, NAMESPACE, statsCacheId(subjectKind, "today"), statsToday);
        await writeOfflineCache(scope, NAMESPACE, statsCacheId(subjectKind, "week"), statsWeek);
      } catch {
        /* keep snapshot */
      }
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

export async function readCachedPomodoroConfig(scope: string, subjectKind: PomodoroSubjectKind) {
  return readOfflineCache(scope, NAMESPACE, configCacheId(subjectKind));
}

export async function readCachedPomodoroSessions(scope: string, subjectKind: PomodoroSubjectKind) {
  return readOfflineCache<{ items: unknown[]; total: number }>(
    scope,
    NAMESPACE,
    sessionsCacheId(subjectKind),
  );
}

export async function readCachedPomodoroStats(
  scope: string,
  subjectKind: PomodoroSubjectKind,
  period: "today" | "week",
) {
  return readOfflineCache(scope, NAMESPACE, statsCacheId(subjectKind, period));
}

export async function countPomodoroPendingOps(): Promise<number> {
  return listOutboxOps(resolveOutboxScope(), POMODORO_OUTBOX_MODULE_ID).then((ops) => ops.length);
}
