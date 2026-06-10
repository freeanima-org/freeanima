import { toolResult } from "@freeanima/engine-tool";
import type { CursorPendingInteraction } from "./cursor-decision.ts";

export type AcpCursorMode = "agent" | "plan" | "ask";

export type AcpPromptResult = {
  session_id: string;
  output: string;
  /** Whether a new ACP session was created this turn */
  new_session: boolean;
  /** Whether Free Anima session binding was reused (not explicit session_id / not new_session) */
  reused_binding: boolean;
  /** Whether session_id was passed explicitly */
  explicit_session: boolean;
  /** Cursor mode used this turn */
  mode?: AcpCursorMode;
  /** Cursor blocking interaction (questions / plan) awaiting LLM decision */
  pending?: CursorPendingInteraction[];
};

export function formatAcpPromptResult(r: AcpPromptResult): string {
  return toolResult(r);
}
