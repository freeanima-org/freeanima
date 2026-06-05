/** Hook → engine 流式事件子集（与 engine StreamEvent 对齐） */
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
