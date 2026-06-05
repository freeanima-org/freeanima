import { credential, loadConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";
import type { AnimaService } from "@freeanima/service";

import { loadWeixinCredentials } from "./weixin/weixin-credentials.ts";

export type PlatformAdapter = {
  name: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export async function discoverPlatforms(service: AnimaService): Promise<PlatformAdapter[]> {
  const adapters: PlatformAdapter[] = [];

  try {
    const token = credential("services/discord", "token");
    const cfg = loadConfig() as Record<string, unknown>;
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
    logComponent("gateway").info(
      "WeChat not configured (pass services/weixin-ilink or ~/.hermes/weixin/accounts/)",
    );
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
    logComponent("shutdown").debug(`停止平台 ${a.name}…`);
    try {
      await a.stop();
      logComponent("shutdown").debug(`平台 ${a.name} 已停止`, { ms: Date.now() - t0 });
    } catch (e) {
      logComponent("shutdown").warn(`平台 ${a.name} 停止失败`, {
        ms: Date.now() - t0,
        err: e,
      });
      throw e;
    }
  }
}
