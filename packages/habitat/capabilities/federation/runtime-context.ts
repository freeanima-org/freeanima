import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import { mountFederationManagerService } from "./runtime-context-service.ts";
import type { FederationHubSessionRegistry } from "./hub-session-registry.ts";
import type { FederationSatelliteClient } from "./satellite-client.ts";

export type FederationManager = {
  hubRegistry: FederationHubSessionRegistry;
  satelliteClient: FederationSatelliteClient | null;
  restartSatelliteClient(): void;
  stopAll(): void;
};

export function bindFederationManager(next: FederationManager | null): void {
  mountFederationManagerService(ensureProcessContext()).set(next);
}

export function getFederationManager(): FederationManager | null {
  return getProcessContext()?.federationManager?.get() ?? null;
}
