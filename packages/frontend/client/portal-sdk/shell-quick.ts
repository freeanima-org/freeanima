/** 壳层快捷入口：Habitat `shell_quick.*` 为权威；内存缓存供 Rail / 菜单共享 */

import { getTypedHabitatClient } from "./habitat-typed-client.ts";
import type { ShellQuickEntryRowPayload } from "@freeanima/shared/rpc-contract/frames/shell-quick.ts";
import { getUserSubjectId } from "./world-context.ts";

export type ShellQuickEntry = ShellQuickEntryRowPayload;

const httpOnly = { transport: "http" as const };

let cache: ShellQuickEntry[] = [];
const listeners = new Set<() => void>();

function habitat() {
  return getTypedHabitatClient();
}

async function withSubjectId<T extends Record<string, unknown>>(
  payload: T,
): Promise<T & { subject_id: number }> {
  return { subject_id: await getUserSubjectId(), ...payload };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeShellQuickEntries(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getShellQuickEntriesSnapshot(): ShellQuickEntry[] {
  return cache;
}

export async function refreshShellQuickEntries(): Promise<ShellQuickEntry[]> {
  const data = await habitat().call("shell_quick.list", await withSubjectId({}), httpOnly);
  cache = data.entries;
  notify();
  return cache;
}

/** 拉取权威列表 */
export async function ensureShellQuickEntries(): Promise<ShellQuickEntry[]> {
  return refreshShellQuickEntries();
}

export function isShellQuickAttached(entityId: number): boolean {
  return cache.some((e) => e.id === entityId);
}

export async function attachShellQuick(entityId: number): Promise<ShellQuickEntry> {
  const data = await habitat().call(
    "shell_quick.attach",
    await withSubjectId({ id: entityId }),
    httpOnly,
  );
  const next = cache.filter((e) => e.id !== data.entry.id);
  next.push(data.entry);
  next.sort((a, b) => a.quick_sort_order - b.quick_sort_order || a.id - b.id);
  cache = next;
  notify();
  return data.entry;
}

export async function detachShellQuick(entityId: number): Promise<void> {
  await habitat().call("shell_quick.detach", await withSubjectId({ id: entityId }), httpOnly);
  cache = cache.filter((e) => e.id !== entityId);
}

export async function toggleShellQuick(entityId: number): Promise<"attached" | "detached"> {
  if (isShellQuickAttached(entityId)) {
    await detachShellQuick(entityId);
    return "detached";
  }
  await attachShellQuick(entityId);
  return "attached";
}
