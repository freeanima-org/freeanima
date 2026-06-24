import { ANIMA_REMOTE_ADDRESS_HEADER } from "../http-dispatch.ts";
import { hasCloudflareProxyHeaders, isLoopbackAddress } from "../remote-auth.ts";

export type EchoRequestSnapshot = {
  method: string;
  /** 客户端请求的完整 URL（Host 为访问域名，经 Tunnel 时不是 127.0.0.1） */
  url: string;
  host: string;
  pathname: string;
  search: string;
  /** Bun requestIP：TCP 对端，cloudflared 转发时通常为 127.0.0.1 */
  remote_address: string | null;
  headers: Record<string, string>;
  body: string | null;
  auth_hint: {
    has_cloudflare_proxy_headers: boolean;
    is_loopback_peer: boolean;
  };
};

export async function buildEchoSnapshot(request: Request): Promise<EchoRequestSnapshot> {
  const url = new URL(request.url);
  const remoteAddress = request.headers.get(ANIMA_REMOTE_ADDRESS_HEADER);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() === ANIMA_REMOTE_ADDRESS_HEADER) return;
    headers[key] = value;
  });
  const body =
    request.method === "GET" || request.method === "HEAD" ? null : await request.clone().text();
  return {
    method: request.method,
    url: request.url,
    host: url.host,
    pathname: url.pathname,
    search: url.search,
    remote_address: remoteAddress,
    headers,
    body,
    auth_hint: {
      has_cloudflare_proxy_headers: hasCloudflareProxyHeaders(request),
      is_loopback_peer: isLoopbackAddress(remoteAddress ?? undefined),
    },
  };
}
