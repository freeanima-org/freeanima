import { currentRemoteToolsDepsService, ensureRemoteToolsDepsService } from "./deps-service.ts";
import type { RemoteToolsServerDeps } from "./ws-server.ts";

export function bindRemoteToolsServerDeps(deps: RemoteToolsServerDeps): void {
  ensureRemoteToolsDepsService().set(deps);
}

export function getRemoteToolsServerDeps(): RemoteToolsServerDeps | null {
  return currentRemoteToolsDepsService()?.get() ?? null;
}

export function clearRemoteToolsServerDeps(): void {
  currentRemoteToolsDepsService()?.clear();
}
