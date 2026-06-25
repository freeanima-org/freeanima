/** Capacitor / electron-store 键名（hub / debug scope） */
export const HUB_URL_KEY = "freeanima.hubUrl";
export const REMOTE_AUTH_TOKEN_KEY = "freeanima.remoteAuthToken";
export const DEBUG_SENTRY_ENABLED_KEY = "freeanima.debug.sentryEnabled";
export const DEBUG_SENTRY_DSN_KEY = "freeanima.debug.sentryDsn";
export const DEBUG_VCONSOLE_ENABLED_KEY = "freeanima.debug.vConsoleEnabled";

export function sapInstanceKey(appId: string): string {
  return `freeanima.sap.instance.${appId}`;
}
