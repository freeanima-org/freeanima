export * from "./types.ts";
export * from "./format.ts";

import type { ClarifyPayload } from "./types.ts";
import {
  formatClarifyDiscord,
  formatClarifyPlain,
  formatClarifyWeixin,
  formatClarifyChatUi,
} from "./format.ts";
import { asRecord } from "@freeanima/shared/util";

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
  const items: ClarifyPayload["items"] = [];
  for (const raw of data.items) {
    const row = asRecord(raw);
    if (!row) continue;
    if (typeof row.question !== "string" || !row.question.trim()) continue;
    const item: ClarifyPayload["items"][number] = { question: row.question.trim() };
    if (Array.isArray(row.choices)) {
      item.choices = row.choices.filter((c): c is string => typeof c === "string").slice(0, 4);
    }
    if (typeof row.default === "string") item.default = row.default;
    items.push(item);
  }
  if (items.length === 0) return null;
  const timeoutSec = Number(data.timeout_sec);
  return {
    items,
    timeout_sec: Number.isFinite(timeoutSec) ? timeoutSec : 1800,
  };
}
