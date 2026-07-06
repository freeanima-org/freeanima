/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/hub-client";

export function getDreamHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
