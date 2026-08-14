import { getActiveRuntimeConfig } from "@freeanima/habitat/platform/config";
import { logComponent } from "@freeanima/habitat/platform/logging";

import { ILINK_BASE_URL } from "./ilink-api.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export type WeixinCredentials = {
  token: string;
  base_url: string;
  /** Bound human WeChat ID (logging/reference; not used for inbound filtering) */
  user_id: string;
  /** iLink bot account ID (segment before colon in token, e.g. `xxxxxxxx@im.bot`) */
  account_id: string;
};

/** Parse bot account_id from iLink token (segment before colon) */
export function botAccountIdFromToken(token: string): string {
  const trimmed = token.trim();
  const colon = trimmed.indexOf(":");
  return colon > 0 ? trimmed.slice(0, colon) : trimmed;
}

function buildCredentials(data: Record<string, unknown>, source: string): WeixinCredentials {
  const token = coerceString(data.token ?? "");
  const accountId = coerceString(data.account_id ?? "").trim() || botAccountIdFromToken(token);
  logComponent("weixin").info(`WeChat credentials loaded from ${source}`, { source });
  return {
    token,
    base_url: coerceString(data.base_url ?? ILINK_BASE_URL),
    user_id: coerceString(data.user_id ?? ""),
    account_id: accountId,
  };
}

/** Habitat runtime `weixin` section or env WEIXIN_ILINK_TOKEN；`enabled: false` 时不加载 */
export function loadWeixinCredentials(): WeixinCredentials | null {
  try {
    const cfg = getActiveRuntimeConfig().data as Record<string, unknown>;
    const weixin = (cfg.weixin ?? {}) as Record<string, unknown>;
    if (weixin.enabled === false) return null;
    const tokenEnv = process.env.WEIXIN_ILINK_TOKEN?.trim();
    const token = coerceString(weixin.token ?? tokenEnv ?? "").trim();
    if (!token) return null;
    return buildCredentials({ ...weixin, token }, "runtime config");
  } catch {
    return null;
  }
}
