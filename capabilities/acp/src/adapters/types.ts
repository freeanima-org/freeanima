import type { PromptCapture, CursorPendingInteraction } from "../cursor-decision.ts";
import type { ACPClient } from "../client.ts";

export type AcpDecisionNeededHandler = (
  pending: CursorPendingInteraction[],
  notes: string[],
) => void | Promise<void>;

export type AcpServerRequestContext = {
  client: ACPClient;
  capture: PromptCapture;
  onDecisionNeeded?: AcpDecisionNeededHandler;
};

/** ACP Agent dialect adapter: parse notifications, respond to server RPC */
export interface AcpAgentAdapter {
  readonly id: string;
  /** After initialize succeeds (e.g. Cursor authenticate) */
  afterInitialize?(client: ACPClient): Promise<void>;
  /** session/update → text fragment for tool return */
  parseSessionUpdate(update: Record<string, unknown>): string | null;
  /**
   * Agent-initiated request with id; null means unsupported (returns -32601)
   * @see https://cursor.com/docs/cli/acp
   */
  handleServerRequest(
    method: string,
    params: Record<string, unknown>,
    ctx?: AcpServerRequestContext,
  ): Record<string, unknown> | null;
}
