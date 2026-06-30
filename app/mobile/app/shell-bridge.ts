/** 构建 / 开发入口：shell-bridge 源码在 app/ 外，经此 shim 纳入 root */
import * as shellBridge from "../src/shell-bridge.ts";

void shellBridge;
