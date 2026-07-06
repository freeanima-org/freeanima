/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/hub-client";

export function getChatHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
