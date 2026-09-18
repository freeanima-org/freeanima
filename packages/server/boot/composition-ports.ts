import { bindHabitatPorts } from "@freeanima/capabilities/ports/bind-habitat-ports.ts";
import { platformPorts } from "@freeanima/capabilities/ports/service.ts";
import type { RemoteToolsServerDeps } from "@freeanima/capabilities/outpost/transport/types.ts";

import { patchRuntimeConfigSection } from "../config/index.ts";
import { habitatDispatch } from "../habitat/dispatch.ts";
import { handleHttpHabitatRestRequestWithAuth } from "../habitat/http-rpc.ts";
import { isOptionalAuthHabitatHttpRequest } from "../habitat/http-rest-auth.ts";
import { initHabitatRouter } from "../habitat/init.ts";

/**
 * 组合根端口绑定。
 *
 * boot 流水线与集成测试 harness 共用同一份实现，避免测试复刻组合根接线而漂移：
 * - 低层只表达意图，运行时配置写入 / habitat 入口由此处注入
 */

/** 运行时配置写入端口（`ctx.platformPorts.patchRuntimeConfigSection`） */
export function bindRuntimeConfigPatchPort(): void {
  // 端口层不 import 组合根：运行时配置写入由此处注入
  platformPorts().patchRuntimeConfigSection = (section, patch) =>
    patchRuntimeConfigSection(section, patch);
}

/** habitat dispatch / REST 入口 / optional-auth 路径表端口（含 REST 路由表编译） */
export function bindHabitatCompositionPorts(): void {
  // REST 路由表来自静态 route bundles；dispatch 在调用时才查特性 handler
  initHabitatRouter();
  bindHabitatPorts({
    dispatch: (deps, method, payload, ctx) =>
      habitatDispatch(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 端口以 unknown 声明 deps，实现按组合根契约收窄
        deps as RemoteToolsServerDeps,
        method,
        payload,
        ctx,
      ),
    restHandler: (req, deps) =>
      handleHttpHabitatRestRequestWithAuth(
        req,
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 同上
        deps as RemoteToolsServerDeps,
      ),
    isOptionalAuthRequest: isOptionalAuthHabitatHttpRequest,
  });
}

/** 集成测试 harness：一次性绑定低层会回调组合根的端口 */
export function bindCompositionPortsForIntegration(): void {
  bindRuntimeConfigPatchPort();
  bindHabitatCompositionPorts();
}
