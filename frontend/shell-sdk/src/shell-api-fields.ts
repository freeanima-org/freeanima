import {
  createBearerFetch,
  resolveConnectAuthToken,
  shouldAttachRemoteAuth,
} from "./remote-auth.ts";
import type { SatelliteShellApi } from "./shell-api.ts";

export function buildShellApiFields(
  hubUrl: string,
  hubWsUrl: string,
  remoteAuthToken: string,
): Pick<SatelliteShellApi, "hubUrl" | "hubWsUrl" | "remoteAuth" | "hubFetch"> {
  const token = remoteAuthToken.trim();
  const remoteAuth = token ? { token } : undefined;
  const hubFetch = token ? createBearerFetch(token, hubUrl) : undefined;
  return {
    hubUrl,
    hubWsUrl,
    ...(remoteAuth !== undefined ? { remoteAuth } : {}),
    ...(hubFetch !== undefined ? { hubFetch } : {}),
  };
}

export function connectAuthTokenForHub(
  hubUrl: string,
  remoteAuthToken: string,
): string | undefined {
  return resolveConnectAuthToken(hubUrl, remoteAuthToken);
}

export function hubRequiresRemoteAuth(hubUrl: string, remoteAuthToken: string): boolean {
  return shouldAttachRemoteAuth(hubUrl, remoteAuthToken);
}
