import type { FederationHubWsDeps } from "./hub-ws-server.ts";

let deps: FederationHubWsDeps | null = null;

export function bindFederationHubWsDeps(next: FederationHubWsDeps): void {
  deps = next;
}

export function getFederationHubWsDeps(): FederationHubWsDeps | null {
  return deps;
}
