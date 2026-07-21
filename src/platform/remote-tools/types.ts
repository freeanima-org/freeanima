import type { AppRuntime } from "../runtime/app-runtime.ts";
import type { RemoteToolsManager } from "@freeanima/capabilities/remote-tools";
import type { MaskRegistryPort } from "../ports/mask-registry.ts";
import type { HubSessionRegistry } from "./habitat-session-registry.ts";
import type { RemoteInstanceRegistry } from "./instance-registry.ts";

export type RemoteToolsServerDeps = {
  runtime: AppRuntime;
  remoteToolsManager: RemoteToolsManager;
  instanceRegistry: RemoteInstanceRegistry;
  hubSessionRegistry: HubSessionRegistry;
  animaVersion: string;
  masks: MaskRegistryPort;
};
