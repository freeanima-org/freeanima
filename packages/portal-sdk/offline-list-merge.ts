/**
 * 列表刷新时保留未 sync 的 temp 行，并可选保留本地已缓存的空 child 数组。
 * 不做泛型 CRUD——仅 diary/note 等「扁平行 + blocks」形状复用。
 */

export type RowWithId = { id: number };

export type RowWithBlocks<TBlock> = RowWithId & {
  blocks: TBlock[];
};

export type BlockWithParent = {
  parent_id: number;
};

/** list 返回空 blocks 时勿覆盖本地已缓存的块。 */
export function preserveEmptyChildArrays<
  TBlock extends BlockWithParent,
  T extends RowWithBlocks<TBlock>,
>(serverItems: T[], localById: Map<number, T>): T[] {
  return serverItems.map((server) => {
    const prev = localById.get(server.id);
    if (!prev || server.blocks.length > 0 || prev.blocks.length === 0) return server;
    return {
      ...server,
      blocks: prev.blocks.map((b) =>
        b.parent_id === server.id ? b : { ...b, parent_id: server.id },
      ),
    };
  });
}

/** 把仍在 outbox create 中的本地 temp 行合并回 server 快照。 */
export function mergeServerRowsKeepingPendingTemps<T extends RowWithId>(
  serverItems: T[],
  localItems: T[],
  pendingTempIds: Set<number>,
  sortMerged: (rows: T[]) => T[],
): T[] {
  if (pendingTempIds.size === 0) return serverItems;
  const serverIds = new Set(serverItems.map((e) => e.id));
  const pendingTemps = localItems.filter((e) => pendingTempIds.has(e.id) && !serverIds.has(e.id));
  if (pendingTemps.length === 0) return serverItems;
  return sortMerged([...pendingTemps, ...serverItems]);
}
