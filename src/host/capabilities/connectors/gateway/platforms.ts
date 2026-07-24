import type { Config } from "@freeanima/host/platform/config";
import { resolveValue } from "@freeanima/host/platform/config";
import { logComponent } from "@freeanima/host/platform/logging";
import type { MessagingPort } from "@freeanima/host/platform/ports/messaging-port";

import { loadWeixinCredentials } from "./weixin/weixin-credentials.ts";

export type PlatformAdapter = {
  name: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

function sectionEnabled(section: Record<string, unknown>): boolean {
  return section.enabled !== false;
}

export async function discoverPlatforms(
  service: MessagingPort,
  config: Config,
): Promise<PlatformAdapter[]> {
  const adapters: PlatformAdapter[] = [];
  const cfg = config.data as Record<string, unknown>;

  try {
    const discordCfg = (cfg.discord ?? {}) as Record<string, unknown>;
    if (sectionEnabled(discordCfg)) {
      const tokenRef = discordCfg.token;
      if (typeof tokenRef !== "string" || !tokenRef.trim()) {
        throw new Error("discord.token not set in Habitat runtime config");
      }
      const token = await resolveValue(tokenRef.trim());
      const { createDiscordAdapter } = await import("./discord/discord-adapter.ts");
      adapters.push(createDiscordAdapter(service, token, discordCfg));
      logComponent("gateway").info("Discovered platform: discord");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logComponent("gateway").info(`Discord not configured: ${msg}`);
  }

  const weixinSection = (cfg.weixin ?? {}) as Record<string, unknown>;
  if (sectionEnabled(weixinSection)) {
    const weixinCreds = loadWeixinCredentials();
    if (weixinCreds) {
      const { createWeixinAdapter } = await import("./weixin/weixin-adapter.ts");
      adapters.push(createWeixinAdapter(service, weixinCreds));
      logComponent("gateway").info("Discovered platform: weixin");
    } else {
      logComponent("gateway").info(
        "WeChat not configured (Habitat runtime config weixin.token or WEIXIN_ILINK_TOKEN)",
      );
    }
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
    } catch (e) {
      logComponent("shutdown").warn(`Platform ${a.name} stop failed`, {
        ms: Date.now() - t0,
        err: e,
      });
      throw e;
    }
    logComponent("shutdown").debug(`Platform ${a.name} stopped`, { ms: Date.now() - t0 });
  }
}
