import {
  createBearerFetch,
  resolveConnectAuthToken,
  shouldAttachRemoteAuth,
} from "./remote-auth.ts";
import type { ShellApi } from "./shell-api.ts";

export function buildShellApiFields(
  habitatUrl: string,
  habitatWsUrl: string,
  remoteAuthToken: string,
): Pick<ShellApi, "habitatUrl" | "habitatWsUrl" | "remoteAuth" | "habitatFetch"> {
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

export function connectAuthTokenForHabitat(
  habitatUrl: string,
  remoteAuthToken: string,
): string | undefined {
  return resolveConnectAuthToken(habitatUrl, remoteAuthToken);
}

export function habitatRequiresRemoteAuth(habitatUrl: string, remoteAuthToken: string): boolean {
  return shouldAttachRemoteAuth(habitatUrl, remoteAuthToken);
}
