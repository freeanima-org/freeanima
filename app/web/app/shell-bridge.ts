/** Vite dev 入口：shell-bridge 源码在 app/ 外，经此 shim 纳入 root */
import { WEB_SHELL_BRIDGE_MODULE } from "../src/shell-bridge.ts";

void WEB_SHELL_BRIDGE_MODULE;
