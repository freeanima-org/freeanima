import { getRootLogger } from "./root-logger.ts";
import type { Logger } from "./types.ts";

/**
 * Component-scoped logger derived from the process root logger.
 *
 * Lives in kernel so lower layers (core/engine/capabilities/features) can log
 * without importing the server composition root.
 */
export function logComponent(component: string): Logger {
  return getRootLogger().with({ component });
}
