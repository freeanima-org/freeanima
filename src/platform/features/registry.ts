import type { FeaturePlugin, FeatureRpcHandler } from "./types.ts";
import { hubRouter } from "../habitat/habitat-router.ts";
import { initHubRouter } from "../habitat/init.ts";
import { toFeatureRpcHandlerMap } from "../habitat/route-handlers.ts";

const plugins: FeaturePlugin[] = [];
const rpcHandlers = new Map<string, FeatureRpcHandler>();

function registerHubRouterHandlers(): void {
  initHubRouter();
  for (const [method, handler] of Object.entries(toFeatureRpcHandlerMap(hubRouter.handlers))) {
    if (rpcHandlers.has(method)) {
      throw new Error(`duplicate hub router handler for ${method}`);
    }
    rpcHandlers.set(method, handler);
  }
}

export function registerFeatures(entries: FeaturePlugin[]): void {
  registerHubRouterHandlers();

  for (const plugin of entries) {
    plugins.push(plugin);
    if (plugin.hub.rpc) {
      for (const [method, handler] of Object.entries(plugin.hub.rpc)) {
        if (rpcHandlers.has(method)) {
          throw new Error(`duplicate feature RPC handler for ${method} (${plugin.id})`);
        }
        rpcHandlers.set(method, handler);
      }
    }
  }
}

export function listFeaturePlugins(): readonly FeaturePlugin[] {
  return plugins;
}

export function getFeatureRpcHandler(method: string): FeatureRpcHandler | undefined {
  return rpcHandlers.get(method);
}

export function resetFeatureRegistryForTests(): void {
  plugins.length = 0;
  rpcHandlers.clear();
}
