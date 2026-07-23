/// <reference lib="dom" />

import { HABITAT_RPC_REST_PREFIX } from "@freeanima/shared/habitat-rpc/urls.ts";

export type BearerFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 最小 Bearer fetch 辅助（不依赖 shell-sdk，避免循环依赖） */
export function buildBearerHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token.trim()}` };
}

export function createBearerFetch(token: string, habitatOrigin: string): BearerFetch {
  const origin = habitatOrigin.replace(/\/$/, "");
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
    if (!url.startsWith(origin)) {
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

export function habitatHttpFromWsUrl(wsUrl: string): string {
  return wsUrl
    .replace(/^ws/i, "http")
    .replace(new RegExp(`${HABITAT_RPC_REST_PREFIX}/?$`, "i"), "");
}
