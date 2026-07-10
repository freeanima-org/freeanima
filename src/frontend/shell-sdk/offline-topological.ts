import type { OfflineOutboxOp } from "./offline-outbox.ts";

/** 按 dependsOn 拓扑排序；无法排序时保持原 fifo 顺序。 */
export function sortOutboxTopological(ops: OfflineOutboxOp[]): OfflineOutboxOp[] {
  if (ops.length <= 1) return ops;

  const opByTempId = new Map<number, OfflineOutboxOp>();
  for (const op of ops) {
    if (op.tempEntityId != null && op.tempEntityId < 0) {
      opByTempId.set(op.tempEntityId, op);
    }
  }

  const inDegree = new Map<string, number>();
  const edges = new Map<string, string[]>();

  for (const op of ops) {
    inDegree.set(op.id, 0);
    edges.set(op.id, []);
  }

  for (const op of ops) {
    for (const dep of op.dependsOn ?? []) {
      const parent = opByTempId.get(dep.tempId);
      if (!parent || parent.id === op.id) continue;
      edges.get(parent.id)?.push(op.id);
      inDegree.set(op.id, (inDegree.get(op.id) ?? 0) + 1);
    }
  }

  const queue = ops.filter((op) => (inDegree.get(op.id) ?? 0) === 0).map((op) => op.id);
  const sorted: OfflineOutboxOp[] = [];
  const opById = new Map(ops.map((op) => [op.id, op]));

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    const op = opById.get(id);
    if (op) sorted.push(op);
    for (const nextId of edges.get(id) ?? []) {
      const deg = (inDegree.get(nextId) ?? 1) - 1;
      inDegree.set(nextId, deg);
      if (deg === 0) queue.push(nextId);
    }
  }

  if (sorted.length < ops.length) {
    const seen = new Set(sorted.map((op) => op.id));
    for (const op of ops) {
      if (!seen.has(op.id)) sorted.push(op);
    }
  }

  return sorted;
}

export function sortOutboxOps(
  ops: OfflineOutboxOp[],
  ordering: "fifo" | "topological",
): OfflineOutboxOp[] {
  if (ordering === "topological") return sortOutboxTopological(ops);
  return ops.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}
