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
  removeOutboxOp,
  updateOutboxOpError,
  type OfflineModuleId,
  type OfflineOutboxOp,
} from "./offline-outbox.ts";
import { sortOutboxOps } from "./offline-topological.ts";

export type FlushModuleOptions = {
  streamContext?: StreamFlushContext;
};

let flushing = false;

export function isOfflineSyncFlushing(): boolean {
  return flushing;
}

async function flushRpcModule(
  adapter: RpcModuleAdapter,
  scope: string,
  ops: OfflineOutboxOp[],
): Promise<void> {
  let compacted = adapter.compactOutbox ? adapter.compactOutbox(ops) : ops;
  compacted = sortOutboxOps(compacted, adapter.ordering);

  for (const op of compacted) {
    const currentMap = await loadIdMap(scope, adapter.moduleId);
    let payload = op.payload;
    if (adapter.resolvePayloadIds) {
      payload = adapter.resolvePayloadIds(payload, currentMap);
    }

    const resolvedOp: OfflineOutboxOp = { ...op, payload };
    const unresolved = (resolvedOp.dependsOn ?? []).some((dep) => !currentMap.has(dep.tempId));
    if (unresolved) continue;

    const result = await adapter.flushOp(resolvedOp, { scope });
    if (result === "done") {
      await removeOutboxOp(scope, op.id);
    } else if (result === "failed") {
      await updateOutboxOpError(scope, op.id, "flush failed");
    }
  }

  await adapter.refreshAll(scope);
}

async function flushStreamModule(
  adapter: StreamModuleAdapter,
  scope: string,
  ops: OfflineOutboxOp[],
  ctx: StreamFlushContext,
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
      if (adapter.preflight) {
        const pre = await adapter.preflight(op, ctx);
        if (pre === "stale" || pre === "abort") {
          if (adapter.breakOnStale && pre === "stale") break;
          continue;
        }
      }
      if (ctx.forceTail && adapter.persistForceTail) {
        await adapter.persistForceTail(op.id, scope);
      }
      const result = await adapter.flushOp(op, ctx);
      if (result === "done") {
        await removeOutboxOp(scope, op.id);
      } else if (result === "stale" && adapter.breakOnStale) {
        break;
      } else if (result === "failed") {
        await updateOutboxOpError(scope, op.id, "flush failed");
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

export async function flushOfflineModule(
  moduleId: OfflineModuleId,
  scope: string,
  opts?: FlushModuleOptions,
): Promise<void> {
  if (!isHubFetchAvailable()) return;
  const adapter = getOfflineModule(moduleId);
  if (!adapter) return;

  const ops = await listOutboxOps(scope, moduleId);
  if (ops.length === 0) return;

  if (adapter.kind === "stream") {
    if (!opts?.streamContext) return;
    await flushStreamModule(adapter, scope, ops, opts.streamContext);
    return;
  }

  await flushRpcModule(adapter, scope, ops);
}

export async function flushAllOfflineModules(
  scope: string,
  opts?: FlushModuleOptions & {
    streamContextByModule?: Partial<Record<"chat", StreamFlushContext>>;
  },
): Promise<void> {
  if (flushing || !isHubFetchAvailable()) return;
  flushing = true;
  try {
    for (const adapter of listOfflineModules()) {
      const ops = await listOutboxOps(scope, adapter.moduleId);
      if (ops.length === 0) continue;

      if (adapter.kind === "stream") {
        const ctx = opts?.streamContextByModule?.chat ?? opts?.streamContext;
        if (ctx) {
          await flushStreamModule(adapter, scope, ops, ctx);
        }
        continue;
      }

      await flushRpcModule(adapter, scope, ops);
    }
  } finally {
    flushing = false;
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
