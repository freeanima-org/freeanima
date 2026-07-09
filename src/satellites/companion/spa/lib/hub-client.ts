/// <reference lib="dom" />
import { whenSatelliteHubRpcReady } from "@freeanima/frontend/shell-sdk/hub-rpc-call";
import type { ClientCompanionConfig } from "@freeanima/satellites/companion/shared/constants.ts";

export type HubCompanionConfig = Omit<
  ClientCompanionConfig,
  "app_id" | "instance_id" | "sap_connected"
> & {
  instance_id?: string;
  sap_connected?: boolean;
};

export type CompanionHubConfigResponse = { config: HubCompanionConfig };

export function getCompanionHubClient() {
  return {
    call<T = unknown>(method: string, payload?: unknown): Promise<T> {
      return whenSatelliteHubRpcReady().then((rpc) => rpc.request<T>(method, payload));
    },
  };
}
