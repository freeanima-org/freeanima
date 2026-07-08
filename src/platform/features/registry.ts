import type { FeatureHttpRegistrar, FeaturePlugin, FeatureRpcHandler } from "./types.ts";

const plugins: FeaturePlugin[] = [];
const rpcHandlers = new Map<string, FeatureRpcHandler>();
const httpRegistrars: FeatureHttpRegistrar[] = [];

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
    if (plugin.hub.registerHttp) {
      httpRegistrars.push(plugin.hub.registerHttp);
    }
  }
}

export function listFeaturePlugins(): readonly FeaturePlugin[] {
  return plugins;
}

export function getFeatureRpcHandler(method: string): FeatureRpcHandler | undefined {
  return rpcHandlers.get(method);
}

export function applyFeatureHttpRegistrations(register: Parameters<FeatureHttpRegistrar>[0]): void {
  for (const registrar of httpRegistrars) {
    registrar(register);
  }
}

export function resetFeatureRegistryForTests(): void {
  plugins.length = 0;
  rpcHandlers.clear();
  httpRegistrars.length = 0;
}
