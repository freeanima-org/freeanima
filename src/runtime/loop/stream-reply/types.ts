/** 流式回合展示分段：纯 reducer 类型（runtime/loop SSOT） */

import type { HookClarifyItem } from "@freeanima/core/hooks/loop";

export type StreamReplyPhase = "idle" | "tool_collecting" | "answer_streaming" | "terminal";

export type AnswerSegment = {
  id: number;
  content: string;
  committed: boolean;
};

export type StreamReplyTerminal = {
  kind: "done" | "error" | "interrupted";
  message?: string;
};

export type StreamReplyState = {
  phase: StreamReplyPhase;
  segments: AnswerSegment[];
  currentAnswer: string;
  activeSegmentId: number | null;
  nextSegmentId: number;
  finalAnswer: string | null;
  terminal?: StreamReplyTerminal;
};

/** 结构化工具调用（Hub display / Gateway 格式化 SSOT） */
export type StructuredToolCall = {
  name: string;
  argsPreview: string;
  tool_call_id: string;
  status: string;
  args?: Record<string, unknown>;
  result?: string;
};

export type StreamReplyEffect =
  | { kind: "tool_round"; calls: StructuredToolCall[] }
  | { kind: "answer_open"; segmentId: number }
  | { kind: "answer_delta"; delta: string }
  | { kind: "answer_replace"; content: string }
  | { kind: "answer_commit"; segmentId: number; content: string }
  | { kind: "answer_finalize"; content: string }
  | {
      kind: "clarify";
      items: HookClarifyItem[];
      timeout_sec: number;
    }
  | { kind: "turn_end"; reason: "done" | "error" | "interrupted"; message?: string };

export type ApplyStreamReplyResult = {
  state: StreamReplyState;
  effects: StreamReplyEffect[];
};
