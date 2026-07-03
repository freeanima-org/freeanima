/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/hub-client";

export function getTaskHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
