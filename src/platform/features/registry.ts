import type { FeaturePlugin, FeatureRpcHandler } from "./types.ts";

const plugins: FeaturePlugin[] = [];
const rpcHandlers = new Map<string, FeatureRpcHandler>();

export function registerFeatures(entries: FeaturePlugin[]): void {
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
