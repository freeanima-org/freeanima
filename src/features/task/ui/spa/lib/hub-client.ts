/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export function getTaskHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
