import type { AppRuntime } from "../runtime/app-runtime.ts";
import type { SatelliteManager } from "@freeanima/capabilities/satellite";
import type { MaskRegistryPort } from "../ports/mask-registry.ts";
import type { HubSessionRegistry } from "./hub-session-registry.ts";
import type { SapInstanceRegistry } from "./instance-registry.ts";

export type SapServerDeps = {
  runtime: AppRuntime;
  satelliteManager: SatelliteManager;
  instanceRegistry: SapInstanceRegistry;
  hubSessionRegistry: HubSessionRegistry;
  animaVersion: string;
  masks: MaskRegistryPort;
};
