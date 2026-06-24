import type {
  SettingsContext,
  SettingsStorageRef,
  SettingsStore,
  SettingsStoreFactory,
} from "@freeanima/satellite-sdk";

declare global {
  interface Window {
    settingsStoreFactory?: SettingsStoreFactory;
    settingsShellClientApi?: {
      load(): Promise<unknown>;
      save(value: unknown): Promise<void>;
      test?(value: unknown): Promise<void>;
    };
  }
}

function shellClientStore(): SettingsStore {
  const api = window.settingsShellClientApi;
  if (!api) throw new Error("settingsShellClientApi 不可用");
  return {
    async load() {
      return api.load();
    },
    async save(value) {
      await api.save(value);
    },
  };
}

function sidecarHttpStore(path: string, ctx: SettingsContext): SettingsStore {
  const origin = ctx.apiOrigin?.replace(/\/$/, "");
  if (!origin) throw new Error("companion sidecar apiOrigin 不可用");
  const url = `${origin}${path}`;
  return {
    async load() {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`加载配置失败 HTTP ${res.status}`);
      return res.json();
    },
    async save(value) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `保存失败 HTTP ${res.status}`);
      }
      return res.json();
    },
  };
}

function hubReadonlyStore(endpoint: string, ctx: SettingsContext): SettingsStore {
  const hubFetch = ctx.hubFetch ?? fetch;
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${ctx.hubUrl.replace(/\/$/, "")}${endpoint}`;
  return {
    async load() {
      const res = await hubFetch(url);
      if (!res.ok) throw new Error(`加载失败 HTTP ${res.status}`);
      return res.json();
    },
    async save() {
      throw new Error("只读配置不可保存");
    },
  };
}

function hubMutationStore(loadPath: string, savePath: string, ctx: SettingsContext): SettingsStore {
  const hubFetch = ctx.hubFetch ?? fetch;
  const base = ctx.hubUrl.replace(/\/$/, "");
  const loadUrl = loadPath.startsWith("http") ? loadPath : `${base}${loadPath}`;
  const saveUrl = savePath.startsWith("http") ? savePath : `${base}${savePath}`;
  return {
    async load() {
      const res = await hubFetch(loadUrl);
      if (!res.ok) throw new Error(`加载失败 HTTP ${res.status}`);
      return res.json();
    },
    async save(value) {
      const res = await hubFetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) throw new Error(`保存失败 HTTP ${res.status}`);
      return res.json();
    },
  };
}

export function createSettingsStore(ref: SettingsStorageRef, ctx: SettingsContext): SettingsStore {
  if (window.settingsStoreFactory) {
    return window.settingsStoreFactory(ref, ctx);
  }
  switch (ref.kind) {
    case "shell-client":
      return shellClientStore();
    case "sidecar-http":
      return sidecarHttpStore(ref.path, ctx);
    case "hub-readonly":
      return hubReadonlyStore(ref.endpoint, ctx);
    case "hub-mutation":
      return hubMutationStore(ref.load, ref.save, ctx);
    case "custom":
      return ref.factory(ctx);
    default: {
      const _exhaustive: never = ref;
      throw new Error(`未知 storage kind: ${(_exhaustive as SettingsStorageRef).kind}`);
    }
  }
}

export function buildSettingsContext(
  appId: string,
  platform: SettingsContext["platform"],
): SettingsContext {
  const shell = window.satelliteShell;
  return {
    appId,
    platform,
    hubUrl: shell?.hubUrl ?? "http://127.0.0.1:2658",
    hubFetch: shell?.hubFetch,
    apiOrigin: shell?.apiOrigin ?? null,
  };
}
