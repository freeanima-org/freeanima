import { credentialRaw, logComponent } from "@freeanima/legacy-kernel";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { ILINK_BASE_URL } from "./ilink-api";

export type WeixinCredentials = {
  token: string;
  base_url: string;
  /** 已绑定的人类微信 ID（日志/参考，不用于过滤入站） */
  user_id: string;
  /** iLink 机器人账号 ID（token 冒号前段，如 `xxxxxxxx@im.bot`） */
  account_id: string;
};

/** 从 iLink token 解析机器人 account_id（Hermes 的 WEIXIN_ACCOUNT_ID） */
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

function loadFromHermesFallback(): WeixinCredentials | null {
  const hermesDir = join(homedir(), ".hermes", "weixin", "accounts");
  if (!existsSync(hermesDir)) return null;

  const files = readdirSync(hermesDir)
    .filter((n) => n.endsWith(".json"))
    .filter((n) => !n.endsWith("context-tokens.json"))
    .filter((n) => !n.startsWith("."))
    .toSorted();

  for (const name of files) {
    try {
      const data = JSON.parse(readFileSync(join(hermesDir, name), "utf-8")) as Record<
        string,
        unknown
      >;
      const token = String(data.token ?? "");
      if (!token) continue;
      return buildCredentials(data, `Hermes config (${name})`);
    } catch {
      continue;
    }
  }
  return null;
}

/** pass `services/weixin-ilink` 优先，其次 Hermes 账户 JSON */
export function loadWeixinCredentials(): WeixinCredentials | null {
  try {
    const data = credentialRaw("services/weixin-ilink");
    const token = String(data.token ?? "");
    if (!token) return loadFromHermesFallback();
    return buildCredentials(data, "pass");
  } catch {
    return loadFromHermesFallback();
  }
}
