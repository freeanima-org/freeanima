import { toolResult } from "@freeanima/core/tool";
import type { CursorPendingInteraction } from "./cursor-decision.ts";

export type AcpCursorMode = "agent" | "plan" | "ask";

export type AcpPromptResult = {
  conversation_id: string;
  output: string;
  /** Whether a new ACP conversation was created this turn */
  new_session: boolean;
  /** Whether Free Anima conversation binding was reused (not explicit conversation_id / not new_session) */
  reused_binding: boolean;
  /** Whether conversation_id was passed explicitly */
  explicit_session: boolean;
  /** Cursor mode used this turn */
  mode?: AcpCursorMode;
  /** Cursor blocking interaction (questions / plan) awaiting LLM decision */
  pending?: CursorPendingInteraction[];
};

export function formatAcpPromptResult(r: AcpPromptResult): string {
  return toolResult(r);
}
