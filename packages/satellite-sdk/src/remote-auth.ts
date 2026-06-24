export type HubFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type RemoteAuthCredentials = {
  token: string;
};

export function isLoopbackHubUrl(hubUrl: string): boolean {
  try {
    const withScheme = /^https?:\/\//i.test(hubUrl) ? hubUrl : `http://${hubUrl}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

export function shouldAttachRemoteAuth(hubUrl: string, token?: string | null): boolean {
  return Boolean(token?.trim()) && !isLoopbackHubUrl(hubUrl);
}

export function buildBearerHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token.trim()}` };
}

export function resolveConnectAuthToken(hubUrl: string, token?: string | null): string | undefined {
  if (!shouldAttachRemoteAuth(hubUrl, token)) return undefined;
  return token!.trim();
}

export function createBearerFetch(token: string, hubOrigin: string): HubFetch {
  const hub = hubOrigin.replace(/\/$/, "");
  return async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : String(input);
    if (!shouldAttachRemoteAuth(hub, token) || !url.startsWith(hub)) {
      return fetch(input, init);
    }
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("Authorization", `Bearer ${token.trim()}`);
    return fetch(input, { ...init, headers });
  };
}

export function shellConfigToRemoteAuth(
  config: { remoteAuthToken?: string } | null | undefined,
): RemoteAuthCredentials | null {
  if (!config?.remoteAuthToken?.trim()) return null;
  return { token: config.remoteAuthToken.trim() };
}
