import { homedir } from "node:os";
import { join } from "node:path";

/** Overridable via FREEANIMA_HOME (test isolation). Default home remains `~/.anima`. */
export function getHomeDir(): string {
  return process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
}

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
  get webuiBuildDir() {
    return homePath("runtime", "webui-build");
  },
  get webuiDevBuildDir() {
    return homePath("runtime", "webui-dev-build");
  },
  get satellitesRuntimeDir() {
    return homePath("runtime", "satellites");
  },
} as const;
