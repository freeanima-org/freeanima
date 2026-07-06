import type { TunnelConfigFields } from "@freeanima/core/config";
import { patchRuntimeConfigSection, loadRuntimeConfigSection } from "@freeanima/platform/config";

function mergeNested<T extends Record<string, unknown>>(
  base: T | undefined,
  patch: Partial<T> | undefined,
): T | undefined {
  if (!patch) return base;
  if (!base) return patch as T;
  return { ...base, ...patch };
}

/** 深度合并 tunnel 段（纯函数，便于单测） */
export function mergeTunnelConfig(
  current: TunnelConfigFields | undefined,
  patch: Partial<TunnelConfigFields>,
): TunnelConfigFields {
  const cloudflare = mergeNested(
    current?.cloudflare as Record<string, unknown> | undefined,
    patch.cloudflare as Record<string, unknown> | undefined,
  );
  const credentials = mergeNested(
    current?.credentials as Record<string, unknown> | undefined,
    patch.credentials as Record<string, unknown> | undefined,
  );
  return {
    ...current,
    ...patch,
    ...(cloudflare !== undefined
      ? { cloudflare: cloudflare as TunnelConfigFields["cloudflare"] }
      : {}),
    ...(credentials !== undefined
      ? { credentials: credentials as TunnelConfigFields["credentials"] }
      : {}),
  };
}

/** 深度合并 tunnel 段并写入 Hub 运行时配置 */
export async function patchTunnelConfig(
  patch: Partial<TunnelConfigFields>,
): Promise<TunnelConfigFields> {
  const current = await loadRuntimeConfigSection<TunnelConfigFields>("tunnel");
  const merged = mergeTunnelConfig(current, patch);
  await patchRuntimeConfigSection("tunnel", merged as Record<string, unknown>);
  return merged;
}

export async function loadTunnelDraft(): Promise<TunnelConfigFields | undefined> {
  return loadRuntimeConfigSection<TunnelConfigFields>("tunnel");
}
