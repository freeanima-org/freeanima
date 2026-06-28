import { FileConfig } from "@freeanima/platform/config";
import type { TunnelConfigFields } from "@freeanima/core/config";

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

/** 深度合并 tunnel 段并写入 config.yaml（用于 setup 逐步保存） */
export function patchTunnelConfig(patch: Partial<TunnelConfigFields>): TunnelConfigFields {
  const cfg = FileConfig.open();
  const merged = mergeTunnelConfig(cfg.data.tunnel, patch);
  cfg.patchSection("tunnel", merged as Record<string, unknown>);
  return merged;
}

export function loadTunnelDraft(): TunnelConfigFields | undefined {
  return FileConfig.open().data.tunnel;
}
