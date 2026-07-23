import {
  createBearerFetch,
  shouldAttachRemoteAuth,
} from "@freeanima/frontend/shell-sdk/remote-auth";

import { apiPath } from "./api-path.ts";
import { resolveApiOrigin } from "./habitat-origin.ts";

type HabitatFetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type { HabitatFetchFn };

type HabitatShell = {
  habitatUrl?: string;
  habitatFetch?: HabitatFetchFn;
  remoteAuth?: { token?: string };
};

let cachedFetch: HabitatFetchFn | undefined;
let cachedFetchKey = "";

function habitatFetchCacheKey(): string {
  const shell = (typeof window !== "undefined" ? window.portalShell : undefined) as
    | HabitatShell
    | undefined;
  const origin = resolveApiOrigin();
  const token = shell?.remoteAuth?.token?.trim() ?? "";
  const bridge = shell?.habitatFetch ? "bridge" : "none";
  return `${origin}\0${token}\0${bridge}`;
}

function wrapHabitatFetch(inner: HabitatFetchFn): HabitatFetchFn {
  return async (input, init) => {
    const res = await inner(input, init);
    if (!res) {
      throw new TypeError("栖息地 fetch 未返回 Response");
    }
    return res;
  };
}

/** bundled 客户端统一 Habitat fetch：优先用 renderer 内 Bearer，避免 preload 函数桥接异常 */
export function resolveHabitatFetch(): HabitatFetchFn {
  const key = habitatFetchCacheKey();
  if (cachedFetch && cachedFetchKey === key) {
    return cachedFetch;
  }

  const shell = (typeof window !== "undefined" ? window.portalShell : undefined) as
    | HabitatShell
    | undefined;
  const origin = resolveApiOrigin();
  const token = shell?.remoteAuth?.token?.trim() ?? "";

  let inner: HabitatFetchFn;
  if (token && shouldAttachRemoteAuth(origin, token)) {
    inner = createBearerFetch(token, origin);
  } else if (shell?.habitatFetch) {
    inner = shell.habitatFetch;
  } else {
    inner = fetch;
  }

  cachedFetch = wrapHabitatFetch(inner);
  cachedFetchKey = key;
  return cachedFetch;
}

export function resetHabitatFetchCache(): void {
  cachedFetch = undefined;
  cachedFetchKey = "";
}

export function hubApiFetch(path: string, init?: RequestInit): Promise<Response> {
  return resolveHabitatFetch()(apiPath(path), init);
}
