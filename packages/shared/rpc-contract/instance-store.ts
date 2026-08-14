/** Persist Habitat-assigned instance_id per deployment environment */

export type RemoteInstanceStore = {
  load(): Promise<string | null> | string | null;
  save(instanceId: string): Promise<void> | void;
};

/** Resolve sync or async instance store load */
export async function loadRemoteInstanceId(store?: RemoteInstanceStore): Promise<string | null> {
  if (!store) return null;
  const result = store.load();
  return result instanceof Promise ? result : result;
}

const STORAGE_PREFIX = "freeanima.outpost.instance.";

export function browserRemoteInstanceStoreKey(habitatOrigin: string, appId: string): string {
  return `${STORAGE_PREFIX}${habitatOrigin}|${appId}`;
}

export function memoryRemoteInstanceStore(initial: string | null = null): RemoteInstanceStore {
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
