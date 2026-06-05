import { credential } from "./credential.ts";
import { loadConfig } from "./config.ts";

/** 解析 pass: 前缀或直连 URL */
export function resolveDatabaseUrl(raw: string): string {
  if (raw.startsWith("pass:")) {
    const passPath = raw.slice("pass:".length);
    try {
      return credential(passPath, "url");
    } catch {
      return credential(passPath);
    }
  }
  return raw;
}

/** 从 config.yaml 读取 database.url；未配置时返回 null */
export function getConfiguredDatabaseUrl(): string | null {
  const cfg = loadConfig();
  const db = cfg.database;
  if (!db?.url) return null;
  return resolveDatabaseUrl(db.url);
}
