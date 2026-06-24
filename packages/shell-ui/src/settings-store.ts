/** form 专用：壳层 settingsShellClientApi（Hub 地址、远程 Token） */
export type SettingsStore<T = unknown> = {
  load(): Promise<T>;
  save(value: T): Promise<void>;
};

declare global {
  interface Window {
    settingsShellClientApi?: {
      load(): Promise<unknown>;
      save(value: unknown): Promise<void>;
      test?(value: unknown): Promise<void>;
    };
  }
}

export function createShellClientStore(): SettingsStore {
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
