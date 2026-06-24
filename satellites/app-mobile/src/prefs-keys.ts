/** Preferences 键名（Capacitor） */
export const HUB_URL_KEY = "freeanima.hubUrl";
export const REMOTE_AUTH_TOKEN_KEY = "freeanima.remoteAuthToken";

export function sapInstanceKey(appId: string): string {
  return `freeanima.sap.instance.${appId}`;
}
