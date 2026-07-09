/// <reference lib="dom" />
import { getBundledHubClient } from "@freeanima/shared/hub-client";

export function getDiaryHubClient() {
  return getBundledHubClient({ profile: "satellite" });
}
