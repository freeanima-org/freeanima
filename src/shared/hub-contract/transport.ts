import type { HttpRouteMeta } from "./http-route.ts";

/** Hub method 支持的传输通道 */
export type TransportKind = "http" | "ws";

/** 客户端 profile：决定 dual method 的 default transport */
export type HubClientProfile = "console" | "satellite";

export type { HttpRouteMeta, HttpRequestEncoding, HttpResponseEncoding } from "./http-route.ts";
export { resolveHttpRequestEncoding, resolveHttpResponseEncoding } from "./http-route.ts";

/** Hub method HTTP/WS 鉴权策略（默认 required） */
export type HubAuthPolicy = "required" | "optional";

export type HubMethodMeta = {
  transports: readonly TransportKind[];
  /** console / satellite profile 下的默认传输 */
  defaultByProfile: Record<HubClientProfile, TransportKind>;
  /** 传输层失败时是否尝试备用通道（写操作默认 false） */
  fallback?: boolean;
  /** Bearer 鉴权：optional 允许无 token（如 health.probe） */
  auth?: HubAuthPolicy;
  /** HTTP REST 路由（transports 含 http 时由 registry finalize 填充） */
  http?: HttpRouteMeta;
  /** dualTransportMeta 传入的部分 http 覆盖，finalize 后清除 */
  httpOverrides?: Partial<HttpRouteMeta>;
};

export function resolveHubAuthPolicy(meta: HubMethodMeta): HubAuthPolicy {
  return meta.auth ?? "required";
}

export function resolveDefaultTransport(
  meta: HubMethodMeta,
  profile: HubClientProfile,
): TransportKind {
  const preferred = meta.defaultByProfile[profile];
  if (meta.transports.includes(preferred)) return preferred;
  return meta.transports[0] ?? "http";
}

export function resolveFallbackTransport(
  meta: HubMethodMeta,
  primary: TransportKind,
): TransportKind | null {
  if (meta.fallback === false) return null;
  const alt = meta.transports.find((t) => t !== primary);
  return alt ?? null;
}
