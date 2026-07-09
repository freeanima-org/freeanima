/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export function getProjectHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
