/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export function getVaultHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
