import { registerHabitatDispatch, registerHabitatRestHandler } from "./habitat-dispatch.ts";

/**
 * 组合根在 boot 时把 habitat dispatch / REST 入口绑到端口
 * （调用点传 `server/habitat` 的实现，端口层不反向 import）。
 */
export function bindHabitatPorts(input: {
  dispatch: Parameters<typeof registerHabitatDispatch>[0];
  restHandler: Parameters<typeof registerHabitatRestHandler>[0];
}): void {
  registerHabitatDispatch(input.dispatch);
  registerHabitatRestHandler(input.restHandler);
}
