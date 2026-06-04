import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { clearConfigCache, resetServiceLogger } from "@freeanima/legacy-kernel";

/** 测试隔离：临时 FREEANIMA_HOME + 重置 logger，避免污染 ~/.anima/error.log */
export function beginLogIsolation(prefix: string): string {
  const home = mkdtempSync(join(tmpdir(), prefix));
  process.env.FREEANIMA_HOME = home;
  resetServiceLogger();
  clearConfigCache();
  return home;
}

/** 恢复 FREEANIMA_HOME；logger 单测应在下次 beginLogIsolation 时重建 */
export function endLogIsolation(prevHome?: string): void {
  if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
  else process.env.FREEANIMA_HOME = prevHome;
  resetServiceLogger();
  clearConfigCache();
}
