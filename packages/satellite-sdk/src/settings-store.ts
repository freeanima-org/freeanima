import type { HubFetch } from "./remote-auth.ts";

export type SettingsPlatform = "desktop" | "mobile";

/** 运行时实例：由壳层 createSettingsStore 创建，注入 SettingsHost → form / component */
export type SettingsStore<T = unknown> = {
  load(): Promise<T>;
  save(value: T): Promise<void>;
  /** save 后通知订阅方（如伴侣 overlay） */
  subscribe?(handler: (value: T) => void): () => void;
};

/** 编译期声明：写在 SettingsSection.storage */
export type SettingsStorageRef =
  | { kind: "shell-client" }
  | { kind: "sidecar-http"; path: string }
  | { kind: "hub-readonly"; endpoint: string }
  | { kind: "hub-mutation"; load: string; save: string }
  | {
      kind: "custom";
      factory: (ctx: SettingsContext) => SettingsStore;
    };

export type SettingsContext = {
  appId: string;
  platform: SettingsPlatform;
  hubUrl: string;
  hubFetch?: HubFetch;
  /** companion sidecar HTTP 根；仅 desktop companion 相关 section */
  apiOrigin?: string | null;
};

export type SettingsStoreFactory = (ref: SettingsStorageRef, ctx: SettingsContext) => SettingsStore;
