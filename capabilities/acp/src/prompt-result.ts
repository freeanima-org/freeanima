import { toolResult } from "@freeanima/engine-tool";
import type { CursorPendingInteraction } from "./cursor-decision.ts";

export type AcpCursorMode = "agent" | "plan" | "ask";

export type AcpPromptResult = {
  session_id: string;
  output: string;
  /** 本次是否新建 ACP session */
  new_session: boolean;
  /** 是否复用逸灵风 session 绑定（非显式 session_id / 非 new_session） */
  reused_binding: boolean;
  /** 是否显式传入 session_id */
  explicit_session: boolean;
  /** 本次使用的 Cursor 模式 */
  mode?: AcpCursorMode;
  /** Cursor 阻塞交互（问题 / 方案）待 LLM 决策 */
  pending?: CursorPendingInteraction[];
};

export function formatAcpPromptResult(r: AcpPromptResult): string {
  return toolResult(r);
}
