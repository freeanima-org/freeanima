/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export function getEmailHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
