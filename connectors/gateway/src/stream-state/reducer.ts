import type { StreamEvent } from "@freeanima/orchestration-loop";
import type { ApplyStreamEventResult, StreamEffect, StreamReplyState } from "./types.ts";
import { formatClarifyForPlatform, parseClarifyStreamEvent } from "../clarify/index.ts";
import { ToolRoundCollector } from "../stream-tool-format.ts";

export type StreamReducePlatform = "discord" | "weixin" | "parlor";

export function initialStreamReplyState(): StreamReplyState {
  return {
    phase: "idle",
    visibleBlocks: [],
    segments: [],
    currentAnswer: "",
    activeSegmentId: null,
    nextSegmentId: 0,
    finalAnswer: null,
  };
}

function commitCurrentAnswer(state: StreamReplyState, effects: StreamEffect[]): StreamReplyState {
  if (state.phase !== "answer_streaming") return state;
  const trimmed = state.currentAnswer.trim();
  if (!trimmed) {
    return {
      ...state,
      currentAnswer: "",
      activeSegmentId: null,
      phase: "idle",
    };
  }
  const segmentId = state.activeSegmentId ?? state.nextSegmentId;
  effects.push({ kind: "answer_commit", segmentId, content: trimmed });
  return {
    ...state,
    segments: [...state.segments, { id: segmentId, content: trimmed, committed: true }],
    currentAnswer: "",
    activeSegmentId: null,
    nextSegmentId: Math.max(state.nextSegmentId, segmentId + 1),
    phase: "idle",
  };
}

function openAnswerSegment(state: StreamReplyState, effects: StreamEffect[]): StreamReplyState {
  if (state.activeSegmentId !== null) return state;
  const segmentId = state.nextSegmentId;
  effects.push({ kind: "answer_open", segmentId });
  return {
    ...state,
    activeSegmentId: segmentId,
    nextSegmentId: segmentId + 1,
    phase: "answer_streaming",
  };
}

/** 工具轮次就绪时：先 commit 答案段，再发出 tool_round */
function flushToolRound(
  state: StreamReplyState,
  collector: ToolRoundCollector,
  effects: StreamEffect[],
): StreamReplyState {
  const text = collector.take();
  if (!text) return state;
  let next = commitCurrentAnswer(state, effects);
  effects.push({ kind: "tool_round", text });
  next = {
    ...next,
    visibleBlocks: [...next.visibleBlocks, text],
    phase: "idle",
  };
  return next;
}

function appendClarify(
  state: StreamReplyState,
  platform: StreamReducePlatform,
  data: Record<string, unknown>,
  effects: StreamEffect[],
): StreamReplyState {
  const payload = parseClarifyStreamEvent(data);
  if (!payload) return state;
  const text = formatClarifyForPlatform(platform, payload);
  effects.push({ kind: "clarify", text });
  return {
    ...state,
    visibleBlocks: [...state.visibleBlocks, text],
  };
}

function finalizeAnswer(state: StreamReplyState, effects: StreamEffect[]): StreamReplyState {
  const trimmed = state.currentAnswer.trim();
  if (trimmed) {
    effects.push({ kind: "answer_finalize", content: trimmed });
  }
  return {
    ...state,
    finalAnswer: trimmed || state.finalAnswer,
    currentAnswer: "",
    activeSegmentId: null,
    phase: "terminal",
  };
}

export function applyStreamEvent(
  state: StreamReplyState,
  event: StreamEvent,
  platform: StreamReducePlatform,
  collector: ToolRoundCollector,
): ApplyStreamEventResult {
  if (state.phase === "terminal") {
    return { state, effects: [] };
  }

  const effects: StreamEffect[] = [];
  let next = state;

  switch (event.event) {
    case "token": {
      next = flushToolRound(next, collector, effects);
      next = openAnswerSegment(next, effects);
      next = {
        ...next,
        currentAnswer: next.currentAnswer + event.data.content,
        phase: "answer_streaming",
      };
      if (event.data.content) {
        effects.push({ kind: "answer_delta", delta: event.data.content });
      }
      break;
    }
    case "content_replace": {
      next = flushToolRound(next, collector, effects);
      next = openAnswerSegment(next, effects);
      next = {
        ...next,
        currentAnswer: event.data.content,
        phase: "answer_streaming",
      };
      effects.push({ kind: "answer_replace", content: event.data.content });
      break;
    }
    case "awaiting_clarify": {
      next = flushToolRound(next, collector, effects);
      next = commitCurrentAnswer(next, effects);
      next = appendClarify(next, platform, event.data, effects);
      break;
    }
    case "tool_begin": {
      next = commitCurrentAnswer(next, effects);
      collector.addBegin(event.data.name, event.data.args);
      next = { ...next, phase: "tool_collecting" };
      break;
    }
    case "tool_result":
      collector.addResult(event.data.name, event.data.content);
      break;
    case "tool_error":
      collector.addError(event.data.content);
      break;
    case "error": {
      next = flushToolRound(next, collector, effects);
      next = finalizeAnswer(next, effects);
      effects.push({ kind: "turn_end", reason: "error", message: event.data.error });
      next = {
        ...next,
        terminal: { kind: "error", message: event.data.error },
      };
      break;
    }
    case "interrupted": {
      next = flushToolRound(next, collector, effects);
      next = finalizeAnswer(next, effects);
      effects.push({
        kind: "turn_end",
        reason: "interrupted",
        message: event.data.reason,
      });
      next = {
        ...next,
        terminal: { kind: "interrupted", message: event.data.reason },
      };
      break;
    }
    case "done": {
      next = flushToolRound(next, collector, effects);
      next = finalizeAnswer(next, effects);
      effects.push({ kind: "turn_end", reason: "done" });
      next = {
        ...next,
        terminal: { kind: "done" },
      };
      break;
    }
    case "accepted":
      break;
    default:
      break;
  }

  return { state: next, effects };
}

export async function reduceStreamEvents(
  events: AsyncIterable<StreamEvent>,
  platform: StreamReducePlatform = "parlor",
): Promise<{ state: StreamReplyState; effects: StreamEffect[] }> {
  let state = initialStreamReplyState();
  const allEffects: StreamEffect[] = [];
  const collector = new ToolRoundCollector();

  for await (const event of events) {
    const result = applyStreamEvent(state, event, platform, collector);
    state = result.state;
    allEffects.push(...result.effects);
    if (state.phase === "terminal") break;
  }

  if (state.phase !== "terminal") {
    const tailEffects: StreamEffect[] = [];
    state = flushToolRound(state, collector, tailEffects);
    allEffects.push(...tailEffects);
    const finEffects: StreamEffect[] = [];
    state = finalizeAnswer(state, finEffects);
    allEffects.push(...finEffects);
    allEffects.push({ kind: "turn_end", reason: "done" });
    state = { ...state, terminal: { kind: "done" } };
  }

  return { state, effects: allEffects };
}
