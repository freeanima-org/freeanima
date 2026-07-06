/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/hub-client";

export function getVaultHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
