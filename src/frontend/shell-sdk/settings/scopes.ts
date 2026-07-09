/** 设置存储作用域 — factory 时写死，store / IPC 不得越界 */
export type SettingsStorageScope =
  | { kind: "kv"; id: "hub" }
  | { kind: "kv"; id: "debug" }
  | { kind: "kv"; id: "companion-shell" }
  /** sidecar 本地缓存；设置 UI 勿用，仅 hub-sync / sidecar 读写 */
  | { kind: "file"; id: "companion"; path: string };

export const HUB_SETTINGS_SCOPE: SettingsStorageScope = { kind: "kv", id: "hub" };
export const DEBUG_SETTINGS_SCOPE: SettingsStorageScope = { kind: "kv", id: "debug" };
export const COMPANION_SHELL_SCOPE: SettingsStorageScope = { kind: "kv", id: "companion-shell" };
/** @internal sidecar 缓存，非设置 UI scope */
export const COMPANION_CONFIG_SCOPE: SettingsStorageScope = {
  kind: "file",
  id: "companion",
  path: "companion/config.json",
};
