import type { AnimaConfig } from "@freeanima/core/config";
import { resolveValue } from "./resolve.ts";

/** Expand env/vault references in database.url */
export async function resolveDatabaseUrl(raw: string): Promise<string> {
  return resolveValue(raw);
}

/** Read database.url from config; null when not configured */
export async function getConfiguredDatabaseUrl(cfg: AnimaConfig): Promise<string | null> {
  const db = cfg.database;
  if (!db?.url) return null;
  return resolveDatabaseUrl(db.url);
}
