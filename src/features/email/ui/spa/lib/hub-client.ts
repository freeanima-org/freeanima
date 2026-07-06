/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/hub-client";

export function getEmailHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
