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

export function habitatRequiresRemoteAuth(habitatUrl: string, remoteAuthToken: string): boolean {
  return shouldAttachRemoteAuth(habitatUrl, remoteAuthToken);
}

/** @deprecated 0.9.3 后删除 — 请用 habitatRequiresRemoteAuth */
export const hubRequiresRemoteAuth = habitatRequiresRemoteAuth;
