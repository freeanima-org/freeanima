import { credential, loadConfig, type NestService } from "@freeanima/core";
import { loadWeixinCredentials } from "./weixin/weixin-credentials.js";

export type PlatformAdapter = {
  name: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export async function discoverPlatforms(service: NestService): Promise<PlatformAdapter[]> {
  const adapters: PlatformAdapter[] = [];

  try {
    const token = credential("services/discord", "token");
    const cfg = loadConfig() as Record<string, unknown>;
    const discordCfg = (cfg.discord ?? {}) as Record<string, unknown>;
    const { createDiscordAdapter } = await import("./discord/discord-adapter.js");
    adapters.push(createDiscordAdapter(service, token, discordCfg));
    console.log("Discovered platform: discord");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`Discord not configured: ${msg}`);
  }

  const weixinCreds = loadWeixinCredentials();
  if (weixinCreds) {
    const { createWeixinAdapter } = await import("./weixin/weixin-adapter.js");
    adapters.push(createWeixinAdapter(service, weixinCreds));
    console.log("Discovered platform: weixin");
  } else {
    console.log(
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
    console.log(`[shutdown] 停止平台 ${a.name}…`);
    try {
      await a.stop();
      console.log(`[shutdown] 平台 ${a.name} 已停止 (+${Date.now() - t0}ms)`);
    } catch (e) {
      console.warn(`[shutdown] 平台 ${a.name} 停止失败 (+${Date.now() - t0}ms): ${e}`);
      throw e;
    }
  }
}
