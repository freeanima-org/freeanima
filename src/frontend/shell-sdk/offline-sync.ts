import { isHubFetchAvailable } from "./hub-fetch-gate.ts";
import { loadIdMap, setIdMapping } from "./offline-id-map.ts";
import { getOfflineModule, listOfflineModules } from "./offline-module-registry.ts";
import type {
  RpcModuleAdapter,
  StreamFlushContext,
  StreamModuleAdapter,
} from "./offline-module-types.ts";
import {
  listOutboxOps,
  markOutboxOpStale,
  removeOutboxOp,
  shouldAutoRetryOp,
  updateOutboxOpError,
  type OfflineModuleId,
  type OfflineOutboxOp,
} from "./offline-outbox.ts";
import { sortOutboxOps } from "./offline-topological.ts";

export type FlushModuleOptions = {
  streamContext?: StreamFlushContext;
  /** 手动重试时绕过 attempts 上限与 stale 跳过。 */
  forceRetry?: boolean;
};

let flushing = false;
/** flush 锁持有期间有新请求进来时置位，finally 里再跑一轮。 */
let pendingRerun = false;
let pendingRerunScope: string | null = null;
let pendingRerunOpts: FlushModuleOptions | null = null;
let pendingRerunAll = false;
let pendingRerunAllOpts:
  | (FlushModuleOptions & {
      streamContextByModule?: Partial<Record<"chat", StreamFlushContext>>;
    })
  | null = null;
let pendingRerunModuleId: OfflineModuleId | null = null;

export function isOfflineSyncFlushing(): boolean {
  return flushing;
}

/** compact 后删除未进入结果集的原始 op，避免孤儿 patch/append 留在 IDB。 */
async function removeAbsorbedOutboxOps(
  scope: string,
  original: OfflineOutboxOp[],
  compacted: OfflineOutboxOp[],
): Promise<void> {
  const kept = new Set(compacted.map((op) => op.id));
  for (const op of original) {
    if (!kept.has(op.id)) {
      await removeOutboxOp(scope, op.id);
    }
  }
}

async function flushRpcModule(
  adapter: RpcModuleAdapter,
  scope: string,
  ops: OfflineOutboxOp[],
  opts?: FlushModuleOptions,
): Promise<void> {
  let compacted = adapter.compactOutbox ? adapter.compactOutbox(ops) : ops;
  if (adapter.compactOutbox) {
    await removeAbsorbedOutboxOps(scope, ops, compacted);
  }
  compacted = sortOutboxOps(compacted, adapter.ordering);

  for (const op of compacted) {
    if (!opts?.forceRetry && !shouldAutoRetryOp(op)) continue;

    const currentMap = await loadIdMap(scope, adapter.moduleId);
    let payload = op.payload;
    if (adapter.resolvePayloadIds) {
      payload = adapter.resolvePayloadIds(payload, currentMap);
    }

    const resolvedOp: OfflineOutboxOp = { ...op, payload };
    const unresolved = (resolvedOp.dependsOn ?? []).some((dep) => !currentMap.has(dep.tempId));
    if (unresolved) continue;

    const outcome = await adapter.flushOp(resolvedOp, { scope });
    if (outcome.status === "done") {
      await removeOutboxOp(scope, op.id);
    } else if (outcome.status === "failed") {
      await updateOutboxOpError(scope, op.id, outcome.error ?? "flush failed");
    }
  }

  await adapter.refreshAll(scope);
}

async function flushStreamModule(
  adapter: StreamModuleAdapter,
  scope: string,
  ops: OfflineOutboxOp[],
  ctx: StreamFlushContext,
  opts?: FlushModuleOptions,
): Promise<void> {
  const sorted = sortOutboxOps(ops, adapter.ordering);
  const byGroup = new Map<string, OfflineOutboxOp[]>();
  for (const op of sorted) {
    const key = adapter.groupKey(op);
    const list = byGroup.get(key) ?? [];
    list.push(op);
    byGroup.set(key, list);
  }

  for (const groupOps of byGroup.values()) {
    for (const op of groupOps) {
      if (!opts?.forceRetry && !shouldAutoRetryOp(op)) continue;

      if (adapter.preflight) {
        const pre = await adapter.preflight(op, ctx);
        if (pre === "stale") {
          await markOutboxOpStale(scope, op.id);
          if (adapter.breakOnStale) break;
          continue;
        }
        if (pre === "abort") {
          continue;
        }
      }
      if (ctx.forceTail && adapter.persistForceTail) {
        await adapter.persistForceTail(op.id, scope);
      }
      const outcome = await adapter.flushOp(op, ctx);
      if (outcome.status === "done") {
        await removeOutboxOp(scope, op.id);
      } else if (outcome.status === "stale") {
        await markOutboxOpStale(scope, op.id);
        if (adapter.breakOnStale) break;
      } else if (outcome.status === "failed") {
        await updateOutboxOpError(scope, op.id, outcome.error ?? "flush failed");
      }
    }
  }

  if (adapter.refreshAll) {
    await adapter.refreshAll(scope);
  }
}

/** Adapter flushOp 成功后调用，写入 temp → server id 映射。 */
export async function recordFlushIdMapping(
  scope: string,
  moduleId: OfflineModuleId,
  tempId: number,
  serverId: number,
): Promise<void> {
  await setIdMapping(scope, moduleId, tempId, serverId);
}

function markPendingRerunModule(
  moduleId: OfflineModuleId,
  scope: string,
  opts?: FlushModuleOptions,
): void {
  pendingRerun = true;
  pendingRerunModuleId = moduleId;
  pendingRerunScope = scope;
  pendingRerunOpts = opts ?? null;
}

function markPendingRerunAll(
  scope: string,
  opts?: FlushModuleOptions & {
    streamContextByModule?: Partial<Record<"chat", StreamFlushContext>>;
  },
): void {
  pendingRerun = true;
  pendingRerunAll = true;
  pendingRerunScope = scope;
  pendingRerunAllOpts = opts ?? null;
}

async function drainPendingRerun(): Promise<void> {
  while (pendingRerun) {
    pendingRerun = false;
    const scope = pendingRerunScope;
    if (!scope || !isHubFetchAvailable()) {
      pendingRerunAll = false;
      pendingRerunModuleId = null;
      pendingRerunScope = null;
      pendingRerunOpts = null;
      pendingRerunAllOpts = null;
      return;
    }

    if (pendingRerunAll) {
      const opts = pendingRerunAllOpts;
      pendingRerunAll = false;
      pendingRerunModuleId = null;
      pendingRerunScope = null;
      pendingRerunOpts = null;
      pendingRerunAllOpts = null;
      await flushAllOfflineModules(scope, opts ?? undefined);
      continue;
    }

    const moduleId = pendingRerunModuleId;
    const opts = pendingRerunOpts;
    pendingRerunModuleId = null;
    pendingRerunScope = null;
    pendingRerunOpts = null;
    if (moduleId) {
      await flushOfflineModule(moduleId, scope, opts ?? undefined);
    }
  }
}

export async function flushOfflineModule(
  moduleId: OfflineModuleId,
  scope: string,
  opts?: FlushModuleOptions,
): Promise<void> {
  // 与 flushAllOfflineModules 共用锁，避免 ChatApp 与 OfflineSyncBootstrap 并发 flush 同一条
  if (!isHubFetchAvailable()) return;
  if (flushing) {
    markPendingRerunModule(moduleId, scope, opts);
    return;
  }
  const adapter = getOfflineModule(moduleId);
  if (!adapter) return;

  const ops = await listOutboxOps(scope, moduleId);
  if (ops.length === 0) {
    await drainPendingRerun();
    return;
  }

  flushing = true;
  try {
    if (adapter.kind === "stream") {
      if (!opts?.streamContext) return;
      await flushStreamModule(adapter, scope, ops, opts.streamContext, opts);
      return;
    }

    await flushRpcModule(adapter, scope, ops, opts);
  } finally {
    flushing = false;
    await drainPendingRerun();
  }
}

export async function flushAllOfflineModules(
  scope: string,
  opts?: FlushModuleOptions & {
    streamContextByModule?: Partial<Record<"chat", StreamFlushContext>>;
  },
): Promise<void> {
  if (!isHubFetchAvailable()) return;
  if (flushing) {
    markPendingRerunAll(scope, opts);
    return;
  }
  flushing = true;
  try {
    for (const adapter of listOfflineModules()) {
      const ops = await listOutboxOps(scope, adapter.moduleId);
      if (ops.length === 0) continue;

      if (adapter.kind === "stream") {
        const ctx = opts?.streamContextByModule?.chat ?? opts?.streamContext;
        if (ctx) {
          await flushStreamModule(adapter, scope, ops, ctx, opts);
        }
        continue;
      }

      await flushRpcModule(adapter, scope, ops, opts);
    }
  } finally {
    flushing = false;
    await drainPendingRerun();
  }
}

export function subscribeOfflineSyncTriggers(onFlush: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const onVisible = () => {
    if (document.visibilityState === "visible") onFlush();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}

/** 测试用：重置 flush 锁与尾触发状态。 */
export function resetOfflineSyncStateForTests(): void {
  flushing = false;
  pendingRerun = false;
  pendingRerunScope = null;
  pendingRerunOpts = null;
  pendingRerunAll = false;
  pendingRerunAllOpts = null;
  pendingRerunModuleId = null;
}
