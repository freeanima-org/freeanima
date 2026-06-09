import { CST_OFFSET_MS as KERNEL_CST_OFFSET_MS } from "@freeanima/kernel-util";
import { homedir } from "node:os";
import { join } from "node:path";

/** 可通过 FREEANIMA_HOME 覆盖（测试隔离）。默认家目录仍为 `~/.anima`（与既有数据兼容）。 */
export function getHomeDir(): string {
  return process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
}

/** @deprecated 优先使用 `@freeanima/kernel-util` 的 `formatCstIso` */
export const CST_OFFSET_MS = KERNEL_CST_OFFSET_MS;

export function homePath(...segments: string[]): string {
  return join(getHomeDir(), ...segments);
}

export const PATHS = {
  get home() {
    return getHomeDir();
  },
  get configYaml() {
    return homePath("config.yaml");
  },
  get eventsDb() {
    return homePath("runtime", "events.db");
  },
  get errorLog() {
    return homePath("error.log");
  },
  get pidFile() {
    return homePath("server.pid");
  },
  get statusFile() {
    return homePath("server.status.json");
  },
  get cronDir() {
    return homePath("cron");
  },
  get masksYaml() {
    return homePath("masks.yaml");
  },
  get weixinDir() {
    return homePath("weixin");
  },
  get weixinSyncFile() {
    return homePath("weixin", "sync.json");
  },
  get weixinContextTokensFile() {
    return homePath("weixin", "context-tokens.json");
  },
  get cjkUserDict() {
    return homePath("cjk", "user.dict");
  },
  get passStore() {
    return join(homedir(), ".password-store");
  },
} as const;
