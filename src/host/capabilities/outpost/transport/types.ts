import type { AppRuntime } from "@freeanima/host/platform/service/app-runtime.ts";
import type { RemoteToolsManager } from "@freeanima/host/capabilities/outpost";
import type { MaskRegistryPort } from "@freeanima/host/platform/ports/mask-registry.ts";
import type { HabitatSessionRegistry } from "./habitat-session-registry.ts";
import type { RemoteInstanceRegistry } from "./instance-registry.ts";

export type RemoteToolsServerDeps = {
  runtime: AppRuntime;
  remoteToolsManager: RemoteToolsManager;
  instanceRegistry: RemoteInstanceRegistry;
  hubSessionRegistry: HabitatSessionRegistry;
  animaVersion: string;
  masks: MaskRegistryPort;
};
