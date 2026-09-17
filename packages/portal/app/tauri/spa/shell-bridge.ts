/** 构建 / 开发入口：shell-bridge 源码在 app/ 外，经此 shim 纳入 Vite root */
import { DESKTOP_SHELL_BRIDGE_MODULE } from "../lib/shell-bridge.ts";

void DESKTOP_SHELL_BRIDGE_MODULE;
