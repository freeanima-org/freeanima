export type BearerFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 最小 Bearer fetch 辅助（不依赖 shell-sdk，避免循环依赖） */
export function buildBearerHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token.trim()}` };
}

export function createBearerFetch(token: string, hubOrigin: string): BearerFetch {
  const hub = hubOrigin.replace(/\/$/, "");
  const bearer = `Bearer ${token.trim()}`;
  return async (input, init) => {
    if (!token.trim()) {
      return fetch(input, init);
    }
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : String(input);
    if (!url.startsWith(hub)) {
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

export function hubHttpFromWsUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/i, "http").replace(/\/hub\/rpc\/v1\/?$/i, "");
}

export function hubRpcWsFromHttp(httpUrl: string): string {
  const base = httpUrl.replace(/\/$/, "");
  return `${base.replace(/^http/i, "ws")}/hub/rpc/v1`;
}
