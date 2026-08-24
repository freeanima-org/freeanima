import type { FederationHubSessionRegistry } from "./hub-session-registry.ts";
import type { FederationSatelliteClient } from "./satellite-client.ts";

export type FederationManager = {
  hubRegistry: FederationHubSessionRegistry;
  satelliteClient: FederationSatelliteClient | null;
  restartSatelliteClient(): void;
  stopAll(): void;
};

let manager: FederationManager | null = null;

export function bindFederationManager(next: FederationManager | null): void {
  manager = next;
}

export function getFederationManager(): FederationManager | null {
  return manager;
}
