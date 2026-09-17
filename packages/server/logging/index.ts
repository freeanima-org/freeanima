export {
  createServiceLogger,
  markStartupPhase,
  logStartupError,
  installErrorLogHandlers,
} from "./service-logging.ts";

/**
 * 进程 logger 句柄（kernel 持有）+ 兼容别名。
 *
 * `logComponent` 现在来自 kernel，低层可直接用；此处再导出以保持服务端内部
 * 既有 import 路径可用（`setServiceLogger`/`resetServiceLogger` 是 kernel
 * root logger 的别名，测试隔离用）。
 */
import { resetRootLoggerForTest, setRootLogger } from "@freeanima/kernel/logging/root-logger.ts";

export { logComponent } from "@freeanima/kernel/logging/component.ts";
export {
  getRootLogger,
  resetRootLoggerForTest,
  setRootLogger,
} from "@freeanima/kernel/logging/root-logger.ts";

export const setServiceLogger = setRootLogger;
export const resetServiceLogger = resetRootLoggerForTest;
