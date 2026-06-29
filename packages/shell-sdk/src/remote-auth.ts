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

function resolveFetchUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return String(input);
}

export function createBearerFetch(token: string, hubOrigin: string): HubFetch {
  const hub = hubOrigin.replace(/\/$/, "");
  const bearer = `Bearer ${token.trim()}`;
  return async (input, init) => {
    const url = resolveFetchUrl(input);
    if (!shouldAttachRemoteAuth(hub, token) || !url.startsWith(hub)) {
      return fetch(input, init);
    }
    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      headers.set("Authorization", bearer);
      return fetch(new Request(input, { ...init, headers }));
    }
    const headers = new Headers(init?.headers);
    headers.set("Authorization", bearer);
    return fetch(input, { ...init, headers });
  };
}

export function shellConfigToRemoteAuth(
  config: { remoteAuthToken?: string } | null | undefined,
): RemoteAuthCredentials | null {
  if (!config?.remoteAuthToken?.trim()) return null;
  return { token: config.remoteAuthToken.trim() };
}
