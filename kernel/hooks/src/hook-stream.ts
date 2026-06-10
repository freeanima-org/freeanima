/** Hook → engine stream event subset (aligned with engine StreamEvent) */
export type HookClarifyItem = {
  question: string;
  choices?: string[];
  default?: string;
};

export type HookStreamEvent =
  | { event: "awaiting_clarify"; data: { items: HookClarifyItem[]; timeout_sec: number } }
  | { event: "done"; data: { reason?: "awaiting_clarify" } };

export type TurnControl = {
  pause: true;
  streamEvents: HookStreamEvent[];
};
