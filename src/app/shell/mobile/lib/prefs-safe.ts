import { Preferences } from "@capacitor/preferences";

export const DEFAULT_PREFS_TIMEOUT_MS = 8_000;

export function withPromiseTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label}超时（${ms}ms）`)), ms);
    }),
  ]);
}

export async function prefsGet(
  opts: Parameters<typeof Preferences.get>[0],
  timeoutMs = DEFAULT_PREFS_TIMEOUT_MS,
): Promise<Awaited<ReturnType<typeof Preferences.get>>> {
  return withPromiseTimeout(Preferences.get(opts), timeoutMs, `读取本地配置(${opts.key})`);
}

export async function prefsSet(
  opts: Parameters<typeof Preferences.set>[0],
  timeoutMs = DEFAULT_PREFS_TIMEOUT_MS,
): Promise<void> {
  await withPromiseTimeout(Preferences.set(opts), timeoutMs, `保存本地配置(${opts.key})`);
}
