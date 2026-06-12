/** 流式出站状态层类型（纯数据，无平台 IO） */

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
  /** 按时间顺序累积的工具轮次 / clarify 可见块 */
  visibleBlocks: string[];
  segments: AnswerSegment[];
  currentAnswer: string;
  /** 当前答案段 id；未打开时为 null */
  activeSegmentId: number | null;
  nextSegmentId: number;
  finalAnswer: string | null;
  terminal?: StreamReplyTerminal;
};

export type StreamEffect =
  | { kind: "tool_round"; text: string }
  | { kind: "answer_open"; segmentId: number }
  | { kind: "answer_delta"; delta: string }
  | { kind: "answer_replace"; content: string }
  | { kind: "answer_commit"; segmentId: number; content: string }
  | { kind: "answer_finalize"; content: string }
  | { kind: "clarify"; text: string }
  | { kind: "turn_end"; reason: "done" | "error" | "interrupted"; message?: string };

export type ApplyStreamEventResult = {
  state: StreamReplyState;
  effects: StreamEffect[];
};
