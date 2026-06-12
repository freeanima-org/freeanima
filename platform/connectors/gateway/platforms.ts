import type { Config } from "@freeanima/platform/config";
import { credential } from "@freeanima/platform/config";
import { logComponent } from "@freeanima/platform/logging";
import type { MessagingPort } from "@freeanima/platform/ports/ports/messaging-port";

import { loadWeixinCredentials } from "./weixin/weixin-credentials.ts";

export type PlatformAdapter = {
  name: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export async function discoverPlatforms(
  service: MessagingPort,
  config: Config,
): Promise<PlatformAdapter[]> {
  const adapters: PlatformAdapter[] = [];

  try {
    const token = credential("services/discord", "token");
    const cfg = config.data as Record<string, unknown>;
    const discordCfg = (cfg.discord ?? {}) as Record<string, unknown>;
    const { createDiscordAdapter } = await import("./discord/discord-adapter.ts");
    adapters.push(createDiscordAdapter(service, token, discordCfg));
    logComponent("gateway").info("Discovered platform: discord");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logComponent("gateway").info(`Discord not configured: ${msg}`);
  }

  const weixinCreds = loadWeixinCredentials();
  if (weixinCreds) {
    const { createWeixinAdapter } = await import("./weixin/weixin-adapter.ts");
    adapters.push(createWeixinAdapter(service, weixinCreds));
    logComponent("gateway").info("Discovered platform: weixin");
  } else {
    logComponent("gateway").info("WeChat not configured (pass services/weixin-ilink)");
  }

  return adapters;
}

export async function startPlatforms(adapters: PlatformAdapter[]): Promise<void> {
  for (const a of adapters) {
    await a.start();
  }
}

export async function stopPlatforms(adapters: PlatformAdapter[]): Promise<void> {
  for (const a of adapters) {
    const t0 = Date.now();
    logComponent("shutdown").debug(`Stopping platform ${a.name}…`);
    try {
      await a.stop();
      logComponent("shutdown").debug(`Platform ${a.name} stopped`, { ms: Date.now() - t0 });
    } catch (e) {
      logComponent("shutdown").warn(`Platform ${a.name} stop failed`, {
        ms: Date.now() - t0,
        err: e,
      });
      throw e;
    }
  }
}
