/// <reference lib="dom" />
import { browserRemoteInstanceStoreKey, type RemoteInstanceStore } from "./instance-store.ts";

export function sapInstanceStoreFromKey(key: string): RemoteInstanceStore {
  return {
    load(): string | null {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(key);
      return raw?.trim() || null;
    },
    save(instanceId: string): void {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(key, instanceId.trim());
    },
  };
}

export function browserRemoteInstanceStore(
  habitatOrigin: string,
  appId: string,
): RemoteInstanceStore {
  return sapInstanceStoreFromKey(browserRemoteInstanceStoreKey(habitatOrigin, appId));
}
