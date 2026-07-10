import {
  createBearerFetch,
  shouldAttachRemoteAuth,
} from "@freeanima/frontend/shell-sdk/remote-auth";

import { apiPath } from "./api-path.ts";
import { resolveApiOrigin } from "./hub-origin.ts";

type HubFetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type { HubFetchFn };

type HubShell = {
  hubUrl?: string;
  hubFetch?: HubFetchFn;
  remoteAuth?: { token?: string };
};

let cachedFetch: HubFetchFn | undefined;
let cachedFetchKey = "";

function hubFetchCacheKey(): string {
  const shell = (typeof window !== "undefined" ? window.satelliteShell : undefined) as
    | HubShell
    | undefined;
  const origin = resolveApiOrigin();
  const token = shell?.remoteAuth?.token?.trim() ?? "";
  const bridge = shell?.hubFetch ? "bridge" : "none";
  return `${origin}\0${token}\0${bridge}`;
}

function wrapHubFetch(inner: HubFetchFn): HubFetchFn {
  return async (input, init) => {
    const res = await inner(input, init);
    if (!res) {
      throw new TypeError("Hub fetch 未返回 Response");
    }
    return res;
  };
}

/** bundled 客户端统一 Hub fetch：优先用 renderer 内 Bearer，避免 preload 函数桥接异常 */
export function resolveHubFetch(): HubFetchFn {
  const key = hubFetchCacheKey();
  if (cachedFetch && cachedFetchKey === key) {
    return cachedFetch;
  }

  const shell = (typeof window !== "undefined" ? window.satelliteShell : undefined) as
    | HubShell
    | undefined;
  const origin = resolveApiOrigin();
  const token = shell?.remoteAuth?.token?.trim() ?? "";

  let inner: HubFetchFn;
  if (token && shouldAttachRemoteAuth(origin, token)) {
    inner = createBearerFetch(token, origin);
  } else if (shell?.hubFetch) {
    inner = shell.hubFetch;
  } else {
    inner = fetch;
  }

  cachedFetch = wrapHubFetch(inner);
  cachedFetchKey = key;
  return cachedFetch;
}

export function resetHubFetchCache(): void {
  cachedFetch = undefined;
  cachedFetchKey = "";
}

export function hubApiFetch(path: string, init?: RequestInit): Promise<Response> {
  return resolveHubFetch()(apiPath(path), init);
}
