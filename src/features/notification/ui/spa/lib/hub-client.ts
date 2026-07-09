/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export function getNotificationHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
