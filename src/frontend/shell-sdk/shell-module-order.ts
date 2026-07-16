import { SHELL_MODULE_IDS, type ShellModuleId } from "./shell-module-visibility.ts";

const STORAGE_KEY = "freeanima.shell-modules.order";

type OrderListener = () => void;
const listeners = new Set<OrderListener>();

let memoryFallback: ShellModuleId[] | null = null;

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** 规范化顺序：去重、过滤非法 ID、补齐缺失模块（append 到末尾）。 */
export function normalizeShellModuleOrder(raw: ShellModuleId[]): ShellModuleId[] {
  const seen = new Set<ShellModuleId>();
  const ordered: ShellModuleId[] = [];
  for (const id of raw) {
    if (!SHELL_MODULE_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  for (const id of SHELL_MODULE_IDS) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
}

function parseOrder(raw: string | null): ShellModuleId[] {
  if (!raw) return [...SHELL_MODULE_IDS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...SHELL_MODULE_IDS];
    const ids = parsed.filter(
      (id): id is ShellModuleId =>
        typeof id === "string" && SHELL_MODULE_IDS.includes(id as ShellModuleId),
    );
    return normalizeShellModuleOrder(ids);
  } catch {
    return [...SHELL_MODULE_IDS];
  }
}

export function readShellModuleOrder(): ShellModuleId[] {
  try {
    const raw = storage()?.getItem(STORAGE_KEY) ?? null;
    if (raw == null && memoryFallback) return [...memoryFallback];
    return parseOrder(raw);
  } catch {
    return memoryFallback ? [...memoryFallback] : [...SHELL_MODULE_IDS];
  }
}

export function writeShellModuleOrder(order: ShellModuleId[]): void {
  const next = normalizeShellModuleOrder(order);
  try {
    const store = storage();
    if (store) {
      store.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      memoryFallback = next;
    }
  } catch {
    memoryFallback = next;
  }
  for (const listener of listeners) listener();
}

export function subscribeShellModuleOrder(listener: OrderListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetShellModuleOrderForTest(): void {
  memoryFallback = null;
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
