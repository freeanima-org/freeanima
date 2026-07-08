/** Hub method 支持的传输通道 */
export type TransportKind = "http" | "ws";

/** 客户端 profile：决定 dual method 的 default transport */
export type HubClientProfile = "console" | "satellite";

export type HubMethodMeta = {
  transports: readonly TransportKind[];
  /** console / satellite profile 下的默认传输 */
  defaultByProfile: Record<HubClientProfile, TransportKind>;
  /** 传输层失败时是否尝试备用通道（写操作默认 false） */
  fallback?: boolean;
};

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
