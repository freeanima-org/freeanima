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
  get habitatBuildDir() {
    return homePath("runtime", "console-build");
  },
  get habitatDevBuildDir() {
    return homePath("runtime", "console-dev-build");
  },
  get binDir() {
    return homePath("bin");
  },
  get tlsDir() {
    return homePath("tls");
  },
  get tlsCertFile() {
    return homePath("tls", "cert.pem");
  },
  get tlsKeyFile() {
    return homePath("tls", "key.pem");
  },
  get vaultAgentMachineKey() {
    return homePath("vault", "agent-machine.key");
  },
  /** 源码 `dev:habitat` 写出的 Web 自动填充 token（明文，0600；生产 service 不写） */
  get devWebTokenFile() {
    return homePath("dev-web.token");
  },
} as const;
