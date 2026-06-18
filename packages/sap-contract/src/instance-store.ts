/** Persist Hub-assigned instance_id per deployment environment */

export type SapInstanceStore = {
  load(): Promise<string | null> | string | null;
  save(instanceId: string): Promise<void> | void;
};

/** Resolve sync or async instance store load */
export async function loadSapInstanceId(store?: SapInstanceStore): Promise<string | null> {
  if (!store) return null;
  const result = store.load();
  return result instanceof Promise ? result : result;
}

const STORAGE_PREFIX = "freeanima.sap.instance.";

export function browserSapInstanceStore(hubOrigin: string, appId: string): SapInstanceStore {
  const key = `${STORAGE_PREFIX}${hubOrigin}|${appId}`;
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

export function memorySapInstanceStore(initial: string | null = null): SapInstanceStore {
  let value = initial;
  return {
    load(): string | null {
      return value;
    },
    save(instanceId: string): void {
      value = instanceId.trim();
    },
  };
}
