import { createTempDir, removeTempDir } from "@freeanima/host/core/util/temp-dir";

import { resetServiceLogger } from "@freeanima/host/platform/logging";

export { resetServiceLogger };

/** Test isolation: temp FREEANIMA_HOME + reset logger to avoid polluting ~/.anima/error.log */
export function beginLogIsolation(prefix: string): string {
  const home = createTempDir(prefix);
  process.env.FREEANIMA_HOME = home;
  resetServiceLogger();
  return home;
}

/** Restore FREEANIMA_HOME and remove temp home when provided */
export function endLogIsolation(prevHome?: string, tempHome?: string): void {
  if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
  else process.env.FREEANIMA_HOME = prevHome;
  resetServiceLogger();
  removeTempDir(tempHome);
}
