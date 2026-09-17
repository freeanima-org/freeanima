const STORAGE_KEY = "freeanima.diary.block-collapsed";

function storage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function readMap(): Record<string, boolean> {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RPC/加载器响应边界
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, boolean>): void {
  const store = storage();
  if (!store) return;
  store.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** 默认展开；仅显式收起时为 true */
export function isBlockCollapsed(blockId: number): boolean {
  return readMap()[String(blockId)] === true;
}

export function setBlockCollapsed(blockId: number, collapsed: boolean): void {
  const map = readMap();
  const key = String(blockId);
  if (collapsed) map[key] = true;
  else delete map[key];
  writeMap(map);
}

export function firstContentParagraph(content: string): string {
  return (
    content
      .split("\n")
      .map((s) => s.trim())
      .find(Boolean) ?? ""
  );
}
