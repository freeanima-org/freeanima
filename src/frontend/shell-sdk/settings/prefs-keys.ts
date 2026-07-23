/** 壳层 prefs 键名（Web localStorage / Tauri store） */
export const HABITAT_URL_KEY = "freeanima.habitatUrl";
export const REMOTE_AUTH_TOKEN_KEY = "freeanima.remoteAuthToken";
export const NATIVE_BUILD_META_KEY = "freeanima.nativeBuildMeta";
export const DEBUG_VCONSOLE_ENABLED_KEY = "freeanima.debug.vConsoleEnabled";
export const LAUNCH_AT_LOGIN_KEY = "freeanima.launchAtLogin";
export const COMPANION_VISIBLE_KEY = "freeanima.companionVisible";

export function sapInstanceKey(appId: string): string {
  return `freeanima.sap.instance.${appId}`;
}

/** localStorage：栖息地 URL */
export function readStoredHabitatUrl(getItem: (key: string) => string | null): string {
  return getItem(HABITAT_URL_KEY)?.trim() || "";
}
