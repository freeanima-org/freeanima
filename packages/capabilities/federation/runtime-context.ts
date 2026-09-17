import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

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
  mountFederationManagerService(ensureRootContext()).set(next);
}

export function getFederationManager(): FederationManager | null {
  return getRootContextOrNull()?.federationManager?.get() ?? null;
}
