import type { SapServerDeps } from "./ws-server.ts";

let sapServerDeps: SapServerDeps | null = null;

export function bindSapServerDeps(deps: SapServerDeps): void {
  sapServerDeps = deps;
}

export function getSapServerDeps(): SapServerDeps | null {
  return sapServerDeps;
}

export function clearSapServerDeps(): void {
  sapServerDeps = null;
}
