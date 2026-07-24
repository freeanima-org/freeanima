import { stripOriginRoutingMeta } from "@freeanima/host/core/db/schema";

function stableSerialize(extra: Record<string, unknown>): string {
  const keys = Object.keys(extra).toSorted();
  return JSON.stringify(keys.map((k) => [k, extra[k]]));
}

export function originLockKey(platform: string, platformExtra: Record<string, unknown>): string {
  return `${platform}:${stableSerialize(stripOriginRoutingMeta(platformExtra))}`;
}

const chains = new Map<string, Promise<void>>();

/** Serialize findOrCreateSession for the same chat origin across concurrent inbound messages. */
export async function runExclusiveOrigin<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => gate);
  chains.set(key, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (chains.get(key) === tail) chains.delete(key);
  }
}
