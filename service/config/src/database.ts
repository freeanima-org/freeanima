import { loadConfig } from "./config.ts";
import { resolveValue } from "./resolve.ts";

/** 展开 database.url 中的 env/credential 引用 */
export async function resolveDatabaseUrl(raw: string): Promise<string> {
  return resolveValue(raw);
}

/** 从 config.yaml 读取 database.url；未配置时返回 null */
export async function getConfiguredDatabaseUrl(): Promise<string | null> {
  const cfg = loadConfig();
  const db = cfg.database;
  if (!db?.url) return null;
  return resolveDatabaseUrl(db.url);
}
