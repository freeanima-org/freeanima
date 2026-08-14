import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { resolveMemoryDeployment } from "@freeanima/habitat/core/config/schemas/memory-config.ts";

import { createEmbeddedMemoryService, type CreateEmbeddedMemoryServiceOpts } from "./embedded.ts";
import type { MemoryService } from "./memory-service.ts";
import { createRemoteMemoryService, type RemoteMemoryServiceOpts } from "./remote.ts";

export type CreateMemoryServiceOpts = {
  embedded?: CreateEmbeddedMemoryServiceOpts;
  remote?: RemoteMemoryServiceOpts;
};

/** 按 memory.deployment 选择 embedded | remote */
export function createMemoryService(opts: CreateMemoryServiceOpts = {}): MemoryService {
  const deployment = resolveMemoryDeployment(getActiveRuntimeConfig().data);
  if (deployment === "remote") {
    if (!opts.remote?.baseUrl) {
      throw new Error(
        "memory.deployment=remote requires createMemoryService({ remote: { baseUrl } })",
      );
    }
    return createRemoteMemoryService(opts.remote);
  }
  return createEmbeddedMemoryService(opts.embedded);
}
