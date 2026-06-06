import type { PromptCapture } from "../cursor-decision.ts";
import type { ACPClient } from "../client.ts";

export type AcpServerRequestContext = {
  client: ACPClient;
  capture: PromptCapture;
};

/** ACP Agent 方言适配：解析通知、应答服务端 RPC */
export interface AcpAgentAdapter {
  readonly id: string;
  /** initialize 成功后（如 Cursor authenticate） */
  afterInitialize?(client: ACPClient): Promise<void>;
  /** session/update → 可拼进工具返回的文本片段 */
  parseSessionUpdate(update: Record<string, unknown>): string | null;
  /**
   * Agent 发起的带 id 请求；返回 null 表示不支持（回 -32601）
   * @see https://cursor.com/docs/cli/acp
   */
  handleServerRequest(
    method: string,
    params: Record<string, unknown>,
    ctx?: AcpServerRequestContext,
  ): Record<string, unknown> | null;
}
