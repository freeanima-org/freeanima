import type { HttpRouteMeta } from "./http-route.ts";

/** Habitat method 支持的传输通道 */
export type TransportKind = "http" | "ws";

/** 客户端 profile：决定 dual method 的 default transport */
export type HabitatClientProfile = "habitat" | "outpost";

export type { HttpRouteMeta, HttpRequestEncoding, HttpResponseEncoding } from "./http-route.ts";
export { resolveHttpRequestEncoding, resolveHttpResponseEncoding } from "./http-route.ts";

/** Habitat method HTTP/WS 鉴权策略（默认 required） */
export type HabitatAuthPolicy = "required" | "optional";

export type HabitatMethodMeta = {
  transports: readonly TransportKind[];
  /** habitat / outpost profile 下的默认传输 */
  defaultByProfile: Record<HabitatClientProfile, TransportKind>;
  /** 传输层失败时是否尝试备用通道（写操作默认 false） */
  fallback?: boolean;
  /** Bearer 鉴权：optional 允许无 token（如 health.probe） */
  auth?: HabitatAuthPolicy;
  /** HTTP REST 路由（transports 含 http 时由 registry finalize 填充） */
  http?: HttpRouteMeta;
  /** dualTransportMeta 传入的部分 http 覆盖，finalize 后清除 */
  httpOverrides?: Partial<HttpRouteMeta>;
};

export function resolveHabitatAuthPolicy(meta: HabitatMethodMeta): HabitatAuthPolicy {
  return meta.auth ?? "required";
}

export function resolveDefaultTransport(
  meta: HabitatMethodMeta,
  profile: HabitatClientProfile,
): TransportKind {
  const preferred = meta.defaultByProfile[profile];
  if (meta.transports.includes(preferred)) return preferred;
  return meta.transports[0] ?? "http";
}

export function resolveFallbackTransport(
  meta: HabitatMethodMeta,
  primary: TransportKind,
): TransportKind | null {
  if (meta.fallback === false) return null;
  const alt = meta.transports.find((t) => t !== primary);
  return alt ?? null;
}
