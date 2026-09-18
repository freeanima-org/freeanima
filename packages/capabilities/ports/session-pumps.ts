/** RPC 会话 SSE/WS pump 控制器（ws-server 创建，特性路由按会话键取用）。 */
import { platformPorts } from "./service.ts";

/** ws-server 在创建会话处理器时注入共享 map（幂等）。 */
export function bindSessionPumps(pumps: Map<string, AbortController>): void {
  platformPorts().sessionPumps = pumps;
}

export function getSessionPumps(): Map<string, AbortController> {
  const pumps = platformPorts().sessionPumps;
  if (!pumps) {
    throw new Error("Session pumps not initialized");
  }
  return pumps;
}

/** @internal 测试隔离 */
export function setSessionPumpsForTest(pumps: Map<string, AbortController> | null): void {
  platformPorts().sessionPumps = pumps;
}
