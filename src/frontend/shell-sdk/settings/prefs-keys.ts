/** Capacitor / electron-store 键名 */
/** 新键；读时仍兼容 freeanima.hubUrl */
export const HABITAT_URL_KEY = "freeanima.habitatUrl";
/** @deprecated 0.9.4 删除 */
export const HABITAT_URL_KEY_LEGACY = "freeanima.hubUrl";
export const REMOTE_AUTH_TOKEN_KEY = "freeanima.remoteAuthToken";
export const NATIVE_BUILD_META_KEY = "freeanima.nativeBuildMeta";
export const DEBUG_VCONSOLE_ENABLED_KEY = "freeanima.debug.vConsoleEnabled";
export const LAUNCH_AT_LOGIN_KEY = "freeanima.launchAtLogin";
export const COMPANION_VISIBLE_KEY = "freeanima.companionVisible";

export function sapInstanceKey(appId: string): string {
  return `freeanima.sap.instance.${appId}`;
}

/** localStorage：新键优先，兼容旧 freeanima.hubUrl */
export function readStoredHabitatUrl(getItem: (key: string) => string | null): string {
  return getItem(HABITAT_URL_KEY)?.trim() || getItem(HABITAT_URL_KEY_LEGACY)?.trim() || "";
}
