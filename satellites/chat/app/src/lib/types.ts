export type DisplayToolCall = {
  name: string;
  argsPreview: string;
  tool_call_id: string;
  status: string;
  args?: Record<string, unknown>;
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

export type ConversationListItem = {
  id: string;
  title: string;
  created: string;
  platform: string;
};

export type StreamApiEvent =
  | { event: "accepted"; data: Record<string, never> }
  | { event: "token"; data: { content: string } }
  | { event: "content_replace"; data: { content: string } }
  | { event: "display_append"; data: { item: DisplayItem } }
  | { event: "tool_begin"; data: { tool: string; args: Record<string, unknown>; content: "" } }
  | { event: "tool_result"; data: { tool: string; content: string } }
  | { event: "tool_error"; data: { tool: string; content: string } }
  | {
      event: "awaiting_clarify";
      data: {
        items: Array<{ question: string; choices?: string[]; default?: string }>;
        timeout_sec: number;
      };
    }
  | { event: "interrupted"; data: { reason: string } }
  | { event: "done"; data: { reason?: "awaiting_clarify" | "interrupted" } }
  | { event: "error"; data: { error: string } }
  | { event: "ping"; data: Record<string, never> };

export type ConversationAcpDockTask = {
  acp_conversation_id: string;
  task_id: string;
  agent_name: string;
  status: string;
  progress_message_id?: string;
};

export type ConversationAcpDockSnapshot = {
  conversation_id: string;
  tasks: ConversationAcpDockTask[];
  progress_text: string;
  task_progress: Record<string, string>;
  highlight_decision: boolean;
};

export type FridgeMagnetsResponse = {
  redis_configured: boolean;
  magnets: Array<{ key: string; value: string }>;
  inject_text: string;
};
