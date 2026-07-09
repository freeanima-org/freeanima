/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export function getChatHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
