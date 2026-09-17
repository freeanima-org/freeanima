import type { Logger } from "@freeanima/kernel/logging";
import { getRuntimeLogger } from "../../config/runtime-logger.ts";

export function logPgComponent(component: string): Logger {
  return getRuntimeLogger().with({ component });
}
