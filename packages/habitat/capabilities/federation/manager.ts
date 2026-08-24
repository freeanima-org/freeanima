import type { Config } from "@freeanima/habitat/core/config";
import type { FederationIdentityMaterial } from "./handshake.ts";
import { FederationHubSessionRegistry } from "./hub-session-registry.ts";
import { FederationSatelliteClient } from "./satellite-client.ts";
import { assertFederationConfigValid, resolveFederationRole } from "./config.ts";
import { bindFederationManager, type FederationManager } from "./runtime-context.ts";

function readIdentityMaterial(config: Config): FederationIdentityMaterial | null {
  const identity = config.data.identity;
  if (!identity) return null;
  return {
    habitat_instance_id: identity.habitat_instance_id,
    public_key: identity.public_key,
    private_key: identity.private_key,
  };
}

export type FederationManagerHandle = FederationManager & {
  updateConfig(config: Config): void;
};

let federationHandle: FederationManagerHandle | null = null;

export function createFederationManager(config: Config): FederationManagerHandle {
  let activeConfig = config;
  const hubRegistry = new FederationHubSessionRegistry();
  let satelliteClient: FederationSatelliteClient | null = null;

  const restartSatelliteClient = () => {
    satelliteClient?.stop();
    satelliteClient = null;
    if (resolveFederationRole(activeConfig.data.federation) !== "satellite") return;
    assertFederationConfigValid(activeConfig.data.federation);
    satelliteClient = new FederationSatelliteClient(
      () => readIdentityMaterial(activeConfig),
      () => activeConfig.data.federation?.hub ?? null,
      () => resolveFederationRole(activeConfig.data.federation) === "satellite",
    );
    satelliteClient.start();
  };

  const handle: FederationManagerHandle = {
    hubRegistry,
    get satelliteClient() {
      return satelliteClient;
    },
    restartSatelliteClient,
    stopAll() {
      hubRegistry.closeAll();
      satelliteClient?.stop();
      satelliteClient = null;
    },
    updateConfig(next) {
      activeConfig = next;
      assertFederationConfigValid(next.data.federation);
      restartSatelliteClient();
    },
  };

  bindFederationManager(handle);
  federationHandle = handle;
  restartSatelliteClient();
  return handle;
}

export function updateFederationManagerConfig(config: Config): void {
  federationHandle?.updateConfig(config);
}

export function getFederationManagerHandle(): FederationManagerHandle | null {
  return federationHandle;
}
