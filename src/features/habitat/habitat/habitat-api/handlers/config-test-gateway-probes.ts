import { Client } from "discord.js";
import {
  ILINK_BASE_URL,
  notifyStart,
} from "@freeanima/host/capabilities/connectors/gateway/weixin/ilink-api.ts";

const PROBE_TIMEOUT_MS = 15_000;

/** Discord Bot token 探测：login 成功即视为连通，随即 destroy */
export async function probeDiscordBotToken(token: string): Promise<{ tag: string }> {
  const client = new Client({ intents: [] });
  try {
    await Promise.race([
      client.login(token),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Discord login 超时")), PROBE_TIMEOUT_MS);
      }),
    ]);
    const tag = client.user?.tag ?? client.user?.username ?? "bot";
    return { tag };
  } finally {
    await client.destroy();
  }
}

/** 微信 iLink token 探测：调用 notifyStart（与 adapter 启动一致） */
export async function probeWeixinIlinkToken(
  token: string,
  baseUrl?: string,
): Promise<{ base_url: string }> {
  const url = (baseUrl?.trim() || ILINK_BASE_URL).replace(/\/$/, "");
  await Promise.race([
    notifyStart(url, token),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("微信 iLink 请求超时")), PROBE_TIMEOUT_MS);
    }),
  ]);
  return { base_url: url };
}
