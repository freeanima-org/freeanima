import { waitForCapacitorBridge } from "./capacitor-ready.ts";
import {
  isMobileCapacitorBridgeExpected,
  readWindowPreferencesPlugin,
  type CapacitorPreferencesApi,
} from "./capacitor-plugins.ts";

export const DEFAULT_PREFS_TIMEOUT_MS = 8_000;

export function withPromiseTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label}超时（${ms}ms）`)), ms);
    }),
  ]);
}

async function resolvePreferencesApi(): Promise<CapacitorPreferencesApi> {
  const fromWindow = readWindowPreferencesPlugin();
  if (fromWindow) return fromWindow;

  if (isMobileCapacitorBridgeExpected()) {
    await waitForCapacitorBridge();
    const retry = readWindowPreferencesPlugin();
    if (retry) return retry;
  }

  throw new Error("Preferences 插件不可用：请确认在 Capacitor 壳内运行且已执行 cap sync android");
}

export async function prefsGet(
  opts: { key: string },
  timeoutMs = DEFAULT_PREFS_TIMEOUT_MS,
): Promise<{ value: string | null }> {
  const api = await resolvePreferencesApi();
  return withPromiseTimeout(api.get(opts), timeoutMs, `读取本地配置(${opts.key})`);
}

export async function prefsSet(
  opts: { key: string; value: string },
  timeoutMs = DEFAULT_PREFS_TIMEOUT_MS,
): Promise<void> {
  const api = await resolvePreferencesApi();
  await withPromiseTimeout(api.set(opts), timeoutMs, `保存本地配置(${opts.key})`);
}
