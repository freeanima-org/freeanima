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
  clientOpId?: string;
  sendStatus?: "pending" | "sending" | "failed" | "stale";
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
  archivedAt?: string | null;
  /** 用户未读 */
  unread?: boolean;
};

export type LlmDebugSnapshotPayload = {
  phase: "initial" | "final";
  turn_index: number;
  model: string;
  tool_count: number;
  tools: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  invoke: {
    system_prompt?: string;
    turns: Array<{
      role: string;
      name?: string;
      content?: string | null;
      tool_calls?: Array<{ id: string; name: string; arguments: string }>;
    }>;
  };
  runtime_injections?: {
    passive_memory_context?: boolean;
    notification_context?: boolean;
  };
  passive_recall?: {
    query: string;
    tsquery: string | null;
    jieba_loaded?: boolean | null;
    effective_min_score: number;
    min_score: number;
    min_relative_score: number;
    fts: Array<{ id: number; score: number; content_preview: string }>;
    trgm: Array<{ id: number; score: number; content_preview: string }>;
    merged: Array<{ id: number; score: number; content_preview: string }>;
    after_score_filter: Array<{ id: number; score: number; content_preview: string }>;
    after_resident_filter: Array<{ id: number; score: number; content_preview: string }>;
    excluded_resident_ids: number[];
    injected: Array<{ id: number; score: number; content_preview: string }>;
    skipped_reason?: string;
    elapsed_ms: number;
  };
};

export type LlmDebugSnapshots = {
  initial?: LlmDebugSnapshotPayload;
  final?: LlmDebugSnapshotPayload;
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
  | {
      event: "error";
      data: {
        error: string;
        code?: string;
        current_tail_pos?: number;
      };
    }
  | { event: "ping"; data: Record<string, never> }
  | { event: "llm_debug"; data: LlmDebugSnapshotPayload };
