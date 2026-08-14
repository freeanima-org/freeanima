/** Hook → engine stream event subset (aligned with engine StreamEvent) */
import type { ClarifyItem } from "@freeanima/habitat/core/db/domain";

export type HookClarifyItem = ClarifyItem;

export type HookStreamEvent =
  | { event: "awaiting_clarify"; data: { items: HookClarifyItem[]; timeout_sec: number } }
  | { event: "done"; data: { reason?: "awaiting_clarify" } };

export type TurnControl = {
  pause: true;
  streamEvents: HookStreamEvent[];
};
