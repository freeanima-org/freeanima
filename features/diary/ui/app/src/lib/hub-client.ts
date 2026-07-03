/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/hub-client";

export function getDiaryHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
