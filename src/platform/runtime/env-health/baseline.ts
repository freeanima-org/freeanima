import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { homePath } from "@freeanima/core/config/paths";
import type { EnvHealthMarkers } from "./types.ts";

export const ENV_HEALTH_BASELINE_FILENAME = "env-health-baseline.json";

export type EnvHealthBaselineStore = {
  load(): EnvHealthMarkers | null;
  save(markers: EnvHealthMarkers): void;
};

let memoryCache: EnvHealthMarkers | null | undefined;

export function baselineFilePath(): string {
  return homePath(ENV_HEALTH_BASELINE_FILENAME);
}

function isMarkers(value: unknown): value is EnvHealthMarkers {
  if (value == null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.hostname === "string" &&
    typeof o.os === "string" &&
    typeof o.timezone === "string" &&
    typeof o.hub_version === "string" &&
    typeof o.boot_started_at === "string" &&
    typeof o.postgres === "string" &&
    typeof o.redis === "string" &&
    typeof o.rss_band === "string" &&
    typeof o.mcp_connected === "number" &&
    typeof o.mcp_servers === "number" &&
    typeof o.acp_connected === "number" &&
    typeof o.acp_agents === "number" &&
    typeof o.disk_free_band === "string"
  );
}

export function createFileBaselineStore(path: string = baselineFilePath()): EnvHealthBaselineStore {
  return {
    load() {
      if (memoryCache !== undefined) return memoryCache;
      if (!existsSync(path)) {
        memoryCache = null;
        return null;
      }
      try {
        const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
        const markers = isMarkers(raw) ? raw : null;
        memoryCache = markers;
        return markers;
      } catch {
        memoryCache = null;
        return null;
      }
    },
    save(markers) {
      const dir = dirname(path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(path, `${JSON.stringify(markers, null, 2)}\n`, "utf-8");
      memoryCache = markers;
    },
  };
}

/** 测试用：清空进程内缓存 */
export function resetBaselineMemoryCacheForTests(): void {
  memoryCache = undefined;
}

let defaultStore: EnvHealthBaselineStore | null = null;

export function getBaselineStore(): EnvHealthBaselineStore {
  if (!defaultStore) defaultStore = createFileBaselineStore();
  return defaultStore;
}

/** 测试注入 */
export function setBaselineStoreForTests(store: EnvHealthBaselineStore | null): void {
  defaultStore = store;
  memoryCache = undefined;
}
