import type { AppRuntime } from "../runtime/app-runtime.ts";
import type { SatelliteManager } from "@freeanima/capabilities-satellite";
import type { MaskRegistryPort } from "../../ports/mask-registry.ts";
import type { SapInstanceRegistry } from "./instance-registry.ts";

export type SapServerDeps = {
  runtime: AppRuntime;
  satelliteManager: SatelliteManager;
  instanceRegistry: SapInstanceRegistry;
  animaVersion: string;
  masks: MaskRegistryPort;
};
