const STORAGE_KEY = "freeanima.shell-modules.primaryCount";

type CountListener = () => void;
const listeners = new Set<CountListener>();

let memoryFallback: number | null | undefined = undefined;

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** 规范化常用个数：正整数；非法返回 null（表示自动/按宽度）。 */
export function normalizeShellModulePrimaryCount(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const floored = Math.floor(n);
  if (floored < 1) return null;
  return floored;
}

export function readShellModulePrimaryCount(): number | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY) ?? null;
    if (raw == null) {
      return memoryFallback === undefined ? null : memoryFallback;
    }
    return normalizeShellModulePrimaryCount(raw);
  } catch {
    return memoryFallback === undefined ? null : memoryFallback;
  }
}

export function writeShellModulePrimaryCount(count: number | null): void {
  const next = normalizeShellModulePrimaryCount(count);
  try {
    const store = storage();
    if (store) {
      if (next == null) store.removeItem(STORAGE_KEY);
      else store.setItem(STORAGE_KEY, String(next));
    } else {
      memoryFallback = next;
    }
  } catch {
    memoryFallback = next;
  }
  for (const listener of listeners) listener();
}

export function subscribeShellModulePrimaryCount(listener: CountListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetShellModulePrimaryCountForTest(): void {
  memoryFallback = undefined;
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
