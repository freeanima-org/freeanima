import type { FeaturePlugin, FeatureRpcHandler } from "./types.ts";
import { habitatRouter } from "../habitat/habitat-router.ts";
import { initHabitatRouter } from "../habitat/init.ts";
import { toFeatureRpcHandlerMap } from "../habitat/route-handlers.ts";

const plugins: FeaturePlugin[] = [];
const rpcHandlers = new Map<string, FeatureRpcHandler>();

function registerHabitatRouterHandlers(): void {
  initHabitatRouter();
  for (const [method, handler] of Object.entries(toFeatureRpcHandlerMap(habitatRouter.handlers))) {
    if (rpcHandlers.has(method)) {
      throw new Error(`duplicate habitat router handler for ${method}`);
    }
    rpcHandlers.set(method, handler);
  }
}

export function registerFeatures(entries: FeaturePlugin[]): void {
  registerHabitatRouterHandlers();

  for (const plugin of entries) {
    plugins.push(plugin);
    const rpc = plugin.habitat?.rpc;
    if (rpc) {
      for (const [method, handler] of Object.entries(rpc)) {
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
