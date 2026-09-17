/**
 * 异步保存完成后合并 draft：保存期间若用户继续编辑，保留当前输入与光标；
 * 若未继续编辑且与服务端一致，则保留原对象引用以避免受控输入重渲染。
 */
export function mergeDraftAfterSave<T>({
  current,
  savingSnapshot,
  synced,
  isEqual,
}: {
  current: T;
  savingSnapshot: T;
  synced: T;
  isEqual: (a: T, b: T) => boolean;
}): { draft: T; baseline: T } {
  const baseline = synced;
  if (!isEqual(current, savingSnapshot)) {
    return { draft: current, baseline };
  }
  if (isEqual(current, synced)) {
    return { draft: current, baseline };
  }
  return { draft: synced, baseline };
}
