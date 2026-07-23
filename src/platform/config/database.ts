import type { BootstrapConfig } from "@freeanima/core/config";
import { resolveValue } from "./resolve.ts";

/** Expand env/vault references in database.url */
export async function resolveDatabaseUrl(raw: string): Promise<string> {
  return resolveValue(raw);
}

/** 从 bootstrap 读取 database.url */
export async function getConfiguredDatabaseUrlFromBootstrap(
  bootstrap: BootstrapConfig,
): Promise<string | null> {
  const db = bootstrap.database;
  if (!db?.url) return null;
  return resolveDatabaseUrl(db.url);
}
