/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export function getDreamHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
