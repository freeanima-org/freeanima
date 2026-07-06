export * from "./types.ts";
export * from "./format.ts";

import type { ClarifyPayload } from "./types.ts";
import {
  formatClarifyDiscord,
  formatClarifyPlain,
  formatClarifyWeixin,
  formatClarifyChatUi,
} from "./format.ts";

export function formatClarifyForPlatform(platform: string, payload: ClarifyPayload): string {
  switch (platform) {
    case "discord":
      return formatClarifyDiscord(payload);
    case "weixin":
      return formatClarifyWeixin(payload);
    case "chat":
      return formatClarifyChatUi(payload);
    default:
      return formatClarifyPlain(payload.items);
  }
}

export function parseClarifyStreamEvent(data: Record<string, unknown>): ClarifyPayload | null {
  if (!Array.isArray(data.items) || data.items.length === 0) return null;
  const items = data.items as ClarifyPayload["items"];
  const timeoutSec = Number(data.timeout_sec);
  return {
    items,
    timeout_sec: Number.isFinite(timeoutSec) ? timeoutSec : 1800,
  };
}
