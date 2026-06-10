import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { clearConfigCache } from "@freeanima/service-config";
import { resetServiceLogger } from "@freeanima/service-logging";

export { resetServiceLogger };

/** Test isolation: temp FREEANIMA_HOME + reset logger to avoid polluting ~/.anima/error.log */
export function beginLogIsolation(prefix: string): string {
  const home = mkdtempSync(join(tmpdir(), prefix));
  process.env.FREEANIMA_HOME = home;
  resetServiceLogger();
  clearConfigCache();
  return home;
}

/** Restore FREEANIMA_HOME; unit tests should rebuild logger on next beginLogIsolation */
export function endLogIsolation(prevHome?: string): void {
  if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
  else process.env.FREEANIMA_HOME = prevHome;
  resetServiceLogger();
  clearConfigCache();
}
