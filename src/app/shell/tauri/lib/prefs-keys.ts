/** 与 shell-sdk/settings/prefs-keys 对齐 */
export const HABITAT_URL_KEY = "freeanima.habitatUrl";
export const REMOTE_AUTH_TOKEN_KEY = "freeanima.remoteAuthToken";
export const NATIVE_BUILD_META_KEY = "freeanima.nativeBuildMeta";
export const DEBUG_VCONSOLE_ENABLED_KEY = "freeanima.debug.vConsoleEnabled";
export const LAUNCH_AT_LOGIN_KEY = "freeanima.launchAtLogin";
export const COMPANION_VISIBLE_KEY = "freeanima.companionVisible";

export function sapInstanceKey(appId: string): string {
  return `freeanima.sap.instance.${appId}`;
}
