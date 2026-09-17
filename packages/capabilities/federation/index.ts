export { attachFederationHubWebSocket, type FederationHubWsDeps } from "./hub-ws-server.ts";
export { FederationHubSessionRegistry, type SatelliteSession } from "./hub-session-registry.ts";
export { FederationSatelliteClient, type SatelliteConnectionState } from "./satellite-client.ts";
export {
  createFederationManager,
  updateFederationManagerConfig,
  getFederationManagerHandle,
  type FederationManagerHandle,
} from "./manager.ts";
export { bindFederationHubWsDeps, getFederationHubWsDeps } from "./hub-runtime-context.ts";
export {
  bindFederationManager,
  getFederationManager,
  type FederationManager,
} from "./runtime-context.ts";
export {
  FEDERATION_WS_PATH,
  resolveFederationRole,
  assertFederationConfigValid,
} from "./config.ts";
export * from "./handshake.ts";
