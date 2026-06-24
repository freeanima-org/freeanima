/** Admin message display view (projected from Slice A StoredMessage) */

export type DisplayToolCall = {
  name: string;
  argsPreview: string;
  tool_call_id: string;
  status: string;
  /** Full tool arguments (JSON object) */
  args?: Record<string, unknown>;
  /** tool role message content */
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
  conversation_id: string;
  display: DisplayItem[];
  total?: number;
  offset?: number;
  limit?: number | null;
};
