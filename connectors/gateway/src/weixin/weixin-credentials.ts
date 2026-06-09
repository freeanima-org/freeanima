import { credentialRaw } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";

import { ILINK_BASE_URL } from "./ilink-api.ts";

export type WeixinCredentials = {
  token: string;
  base_url: string;
  /** 已绑定的人类微信 ID（日志/参考，不用于过滤入站） */
  user_id: string;
  /** iLink 机器人账号 ID（token 冒号前段，如 `xxxxxxxx@im.bot`） */
  account_id: string;
};

/** 从 iLink token 解析机器人 account_id（token 冒号前段） */
export function botAccountIdFromToken(token: string): string {
  const trimmed = token.trim();
  const colon = trimmed.indexOf(":");
  return colon > 0 ? trimmed.slice(0, colon) : trimmed;
}

function buildCredentials(data: Record<string, unknown>, source: string): WeixinCredentials {
  const token = String(data.token ?? "");
  const accountId = String(data.account_id ?? "").trim() || botAccountIdFromToken(token);
  logComponent("weixin").info(`WeChat credentials loaded from ${source}`, { source });
  return {
    token,
    base_url: String(data.base_url ?? ILINK_BASE_URL),
    user_id: String(data.user_id ?? ""),
    account_id: accountId,
  };
}

/** pass `services/weixin-ilink` */
export function loadWeixinCredentials(): WeixinCredentials | null {
  try {
    const data = credentialRaw("services/weixin-ilink");
    const token = String(data.token ?? "");
    if (!token) return null;
    return buildCredentials(data, "pass");
  } catch {
    return null;
  }
}
