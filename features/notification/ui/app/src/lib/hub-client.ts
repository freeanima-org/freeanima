/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/hub-client";

export function getNotificationHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
