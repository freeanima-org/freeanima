import {
  currentFederationManagerService,
  ensureFederationManagerService,
} from "./runtime-context-service.ts";
import type { FederationHubSessionRegistry } from "./hub-session-registry.ts";
import type { FederationSatelliteClient } from "./satellite-client.ts";

export type FederationManager = {
  hubRegistry: FederationHubSessionRegistry;
  satelliteClient: FederationSatelliteClient | null;
  restartSatelliteClient(): void;
  stopAll(): void;
};

export function bindFederationManager(next: FederationManager | null): void {
  ensureFederationManagerService().set(next);
}

export function getFederationManager(): FederationManager | null {
  return currentFederationManagerService()?.get() ?? null;
}
