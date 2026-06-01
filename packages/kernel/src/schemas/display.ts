/** WebUI 消息展示视图（由 L1 SessionMessage 投影，非 HTTP 契约） */

export type DisplayToolCall = {
  name: string;
  argsPreview: string;
  tool_call_id: string;
  status: string;
  /** 完整工具参数（JSON 对象） */
  args?: Record<string, unknown>;
  /** tool role 消息内容 */
  result?: string;
};

export type DisplayMessageItem = {
  type: "message";
  role: "user" | "assistant";
  content: string;
};

export type DisplayToolBlockItem = {
  type: "tool_block";
  calls: DisplayToolCall[];
};

export type DisplayItem = DisplayMessageItem | DisplayToolBlockItem;

export type MessagesDisplay = {
  session_id: string;
  display: DisplayItem[];
  total?: number;
  offset?: number;
  limit?: number | null;
};
