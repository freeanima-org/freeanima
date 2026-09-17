import type { AppRuntime } from "@freeanima/server/service/app-runtime.ts";
import type { RemoteToolsManager } from "@freeanima/capabilities/outpost";
import type { HabitatSessionRegistry } from "./habitat-session-registry.ts";
import type { RemoteInstanceRegistry } from "./instance-registry.ts";

export type RemoteToolsServerDeps = {
  runtime: AppRuntime;
  remoteToolsManager: RemoteToolsManager;
  instanceRegistry: RemoteInstanceRegistry;
  hubSessionRegistry: HabitatSessionRegistry;
  animaVersion: string;
};
