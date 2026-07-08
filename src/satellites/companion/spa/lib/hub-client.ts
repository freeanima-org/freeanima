/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/hub-client";

export function getCompanionHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
