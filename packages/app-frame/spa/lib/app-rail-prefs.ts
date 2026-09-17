const STORAGE_KEY = "freeanima.shell-rail.expanded";

type RailExpandedListener = () => void;
const listeners = new Set<RailExpandedListener>();

let memoryFallback = false;

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function readAppRailExpanded(): boolean {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return memoryFallback;
}

export function writeAppRailExpanded(expanded: boolean): void {
  memoryFallback = expanded;
  try {
    storage()?.setItem(STORAGE_KEY, expanded ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
  for (const listener of listeners) listener();
}

export function subscribeAppRailExpanded(listener: RailExpandedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetShellRailExpandedForTest(): void {
  memoryFallback = false;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener();
}
