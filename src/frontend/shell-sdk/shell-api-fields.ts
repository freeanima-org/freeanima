import {
  createBearerFetch,
  resolveConnectAuthToken,
  shouldAttachRemoteAuth,
} from "./remote-auth.ts";
import type { SatelliteShellApi } from "./shell-api.ts";

export function buildShellApiFields(
  habitatUrl: string,
  habitatWsUrl: string,
  remoteAuthToken: string,
): Pick<SatelliteShellApi, "habitatUrl" | "habitatWsUrl" | "remoteAuth" | "habitatFetch"> {
  const token = remoteAuthToken.trim();
  const remoteAuth = token ? { token } : undefined;
  const habitatFetch = token ? createBearerFetch(token, habitatUrl) : undefined;
  return {
    habitatUrl,
    habitatWsUrl,
    ...(remoteAuth !== undefined ? { remoteAuth } : {}),
    ...(habitatFetch !== undefined ? { habitatFetch } : {}),
  };
}

export function connectAuthTokenForHub(
  habitatUrl: string,
  remoteAuthToken: string,
): string | undefined {
  return resolveConnectAuthToken(habitatUrl, remoteAuthToken);
}

export function hubRequiresRemoteAuth(habitatUrl: string, remoteAuthToken: string): boolean {
  return shouldAttachRemoteAuth(habitatUrl, remoteAuthToken);
}
