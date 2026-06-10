import type { PromptCapture } from "../cursor-decision.ts";
import type { ACPClient } from "../client.ts";

export type AcpServerRequestContext = {
  client: ACPClient;
  capture: PromptCapture;
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
