/** form 专用：壳层 settingsShellClientApi（Hub 地址、远程 Token） */
export type SettingsStore<T = unknown> = {
  load(): Promise<T>;
  save(value: T): Promise<void>;
  test?(value: T): Promise<void>;
};

type ShellClientApi = NonNullable<Window["settingsShellClientApi"]>;

declare global {
  interface Window {
    settingsShellClientApi?: {
      load(): Promise<unknown>;
      save(value: unknown): Promise<void>;
      test?(value: unknown): Promise<void>;
    };
  }
}

export function createShellClientStore(api?: ShellClientApi): SettingsStore {
  const resolved = api ?? window.settingsShellClientApi;
  if (!resolved) throw new Error("settingsShellClientApi 不可用");
  return {
    async load() {
      return resolved.load();
    },
    async save(value) {
      await resolved.save(value);
    },
    ...(resolved.test
      ? {
          async test(value: unknown) {
            await resolved.test!(value);
          },
        }
      : {}),
  };
}
