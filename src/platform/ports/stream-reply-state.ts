/** 流式出站状态层类型 — runtime SSOT + Gateway 可见块 */

import type { HookClarifyItem } from "@freeanima/core/hooks/loop";
import type {
  AnswerSegment,
  ApplyStreamReplyResult,
  StreamReplyEffect,
  StreamReplyPhase,
  StreamReplyState as CoreStreamReplyState,
  StreamReplyTerminal,
  StructuredToolCall,
} from "@freeanima/runtime/loop/stream-reply";

export type {
  AnswerSegment,
  ApplyStreamReplyResult,
  StreamReplyEffect,
  StreamReplyPhase,
  StreamReplyTerminal,
  StructuredToolCall,
};

/** Gateway 层状态：在 core reducer 状态上追加 IM 可见块审计 */
export type StreamReplyState = CoreStreamReplyState & {
  visibleBlocks: string[];
};

/** Gateway strategy 层 effect（tool_round 为 IM 文本） */
export type StreamEffect =
  | { kind: "tool_round"; text: string }
  | { kind: "answer_open"; segmentId: number }
  | { kind: "answer_delta"; delta: string }
  | { kind: "answer_replace"; content: string }
  | { kind: "answer_commit"; segmentId: number; content: string }
  | { kind: "answer_finalize"; content: string }
  | {
      kind: "clarify";
      text: string;
      items: HookClarifyItem[];
      timeout_sec: number;
    }
  | { kind: "turn_end"; reason: "done" | "error" | "interrupted"; message?: string };

export type ApplyStreamEventResult = {
  state: StreamReplyState;
  effects: StreamEffect[];
};
