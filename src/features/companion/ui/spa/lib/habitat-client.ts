/// <reference lib="dom" />
import { whenPortalHabitatRpcReady } from "@freeanima/frontend/shell-sdk/habitat-rpc-call";
import type { ClientCompanionConfig } from "@freeanima/features/companion/shared/constants.ts";

export type HabitatCompanionConfig = Omit<
  ClientCompanionConfig,
  "app_id" | "instance_id" | "remote_tools_connected"
> & {
  instance_id?: string;
  remote_tools_connected?: boolean;
};

export type CompanionHabitatConfigResponse = { config: HabitatCompanionConfig };

export function getCompanionHabitatClient() {
  return {
    call<T = unknown>(method: string, payload?: unknown): Promise<T> {
      return whenPortalHabitatRpcReady().then((rpc) => rpc.request<T>(method, payload));
    },
  };
}
