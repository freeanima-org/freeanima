import type { FederationConfig } from "@freeanima/habitat/core/config/schemas/federation.ts";

export function resolveFederationRole(
  config: FederationConfig | undefined,
): "disabled" | "hub" | "satellite" {
  if (!config?.enabled || config.role === "disabled") return "disabled";
  return config.role;
}

export function assertFederationConfigValid(config: FederationConfig | undefined): void {
  if (!config) return;
  if (!config.enabled) return;
  if (config.role === "hub" && config.hub != null) {
    throw new Error("federation: Hub 角色不可配置 federation.hub");
  }
  if (config.role === "satellite" && config.hub == null) {
    throw new Error("federation: Satellite 须配置 federation.hub");
  }
}

export const FEDERATION_WS_PATH = "/rpc/v1/federation/connect";
