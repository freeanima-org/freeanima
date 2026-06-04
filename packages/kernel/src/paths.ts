import { homedir } from "node:os";
import { join } from "node:path";

/** 可通过 FREEANIMA_HOME 覆盖（测试隔离）。默认家目录仍为 `~/.anima`（与既有数据兼容）。 */
export function getHomeDir(): string {
  return process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
}

export const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

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
  get soul() {
    return process.env.SOUL_PATH ?? homePath("SOUL.md");
  },
  get sessions() {
    return homePath("sessions");
  },
  get processed() {
    return homePath("processed");
  },
  get memory() {
    return homePath("memory");
  },
  get index() {
    return homePath("index");
  },
  get todos() {
    return homePath("todos.json");
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
  get weixinDir() {
    return homePath("weixin");
  },
  get weixinSyncFile() {
    return homePath("weixin", "sync.json");
  },
  get weixinContextTokensFile() {
    return homePath("weixin", "context-tokens.json");
  },
  get passStore() {
    return join(homedir(), ".password-store");
  },
} as const;

export const CREDENTIAL_MAP: Record<string, string> = {
  /** @deprecated 使用 llm.providers.*.api_key；注入时仍读此 pass 路径 */
  api_key: "api/opencode-go",
  llm_api_key: "api/opencode-go",
};
