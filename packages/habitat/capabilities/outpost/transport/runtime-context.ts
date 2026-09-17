import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import { mountRemoteToolsDepsService } from "./deps-service.ts";
import type { RemoteToolsServerDeps } from "./ws-server.ts";

export function bindRemoteToolsServerDeps(deps: RemoteToolsServerDeps): void {
  mountRemoteToolsDepsService(ensureProcessContext()).set(deps);
}

export function getRemoteToolsServerDeps(): RemoteToolsServerDeps | null {
  return getProcessContext()?.remoteToolsDeps?.get() ?? null;
}

export function clearRemoteToolsServerDeps(): void {
  getProcessContext()?.remoteToolsDeps?.clear();
}
