import type { Config } from "@freeanima/habitat/core/config";

import { createPgBusinessScanBackend } from "./pg-business-scan.ts";
import { createPgSearchIndexBackend } from "./pg-search-index/backend.ts";
import { registerSearchBackend } from "./runtime.ts";

/** Bind SearchBackend from runtime `fts.backend` (default pg_search_index). */
export function bindSearchRuntime(config: Config): void {
  const id = config.data.fts?.backend ?? "pg_search_index";
  if (id === "pg_business_scan") {
    registerSearchBackend(createPgBusinessScanBackend());
    return;
  }
  registerSearchBackend(createPgSearchIndexBackend());
}
