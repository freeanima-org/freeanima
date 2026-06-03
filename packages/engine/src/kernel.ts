import { HookRegistry } from "@freeanima/hooks";
import { Kernel } from "@freeanima/kernel";
import { createServiceLogger, setServiceLogger } from "@freeanima/legacy-kernel";

const logger = createServiceLogger();
setServiceLogger(logger);
const hookRegistry = new HookRegistry(logger);

export const kernel = new Kernel(hookRegistry, logger);
