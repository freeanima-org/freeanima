import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

import { mountRemoteToolsDepsService } from "./deps-service.ts";
import type { RemoteToolsServerDeps } from "./ws-server.ts";

export function bindRemoteToolsServerDeps(deps: RemoteToolsServerDeps): void {
  mountRemoteToolsDepsService(ensureRootContext()).set(deps);
}

export function getRemoteToolsServerDeps(): RemoteToolsServerDeps | null {
  return getRootContextOrNull()?.remoteToolsDeps?.get() ?? null;
}

export function clearRemoteToolsServerDeps(): void {
  getRootContextOrNull()?.remoteToolsDeps?.clear();
}
