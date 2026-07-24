import type { RemoteToolsServerDeps } from "./ws-server.ts";

let sapServerDeps: RemoteToolsServerDeps | null = null;

export function bindRemoteToolsServerDeps(deps: RemoteToolsServerDeps): void {
  sapServerDeps = deps;
}

export function getRemoteToolsServerDeps(): RemoteToolsServerDeps | null {
  return sapServerDeps;
}

export function clearRemoteToolsServerDeps(): void {
  sapServerDeps = null;
}
