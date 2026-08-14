/// <reference lib="dom" />
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import type { ClientCompanionConfig } from "@freeanima/shared/companion-app/constants.ts";

export type HabitatCompanionConfig = Omit<
  ClientCompanionConfig,
  "app_id" | "instance_id" | "remote_tools_connected"
> & {
  instance_id?: string;
  remote_tools_connected?: boolean;
};

export type CompanionHabitatConfigResponse = { config: HabitatCompanionConfig };

/** Companion UI 统一 Habitat client（JSON → call；multipart/raw → callRaw） */
export function getCompanionHabitatClient() {
  return getTypedHabitatClient();
}
