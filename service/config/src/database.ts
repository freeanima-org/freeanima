import { loadConfig } from "./config.ts";
import { resolveValue } from "./resolve.ts";

/** Expand env/credential references in database.url */
export async function resolveDatabaseUrl(raw: string): Promise<string> {
  return resolveValue(raw);
}

/** Read database.url from config.yaml; null when not configured */
export async function getConfiguredDatabaseUrl(): Promise<string | null> {
  const cfg = loadConfig();
  const db = cfg.database;
  if (!db?.url) return null;
  return resolveDatabaseUrl(db.url);
}
