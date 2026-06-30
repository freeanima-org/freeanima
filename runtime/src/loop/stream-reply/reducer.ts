import type { StreamEvent } from "../loop-engine.ts";
import { ToolRoundBuffer } from "./tool-round-buffer.ts";
import type { ApplyStreamReplyResult, StreamReplyEffect, StreamReplyState } from "./types.ts";

export function initialStreamReplyState(): StreamReplyState {
  return {
    phase: "idle",
    segments: [],
    currentAnswer: "",
    activeSegmentId: null,
    nextSegmentId: 0,
    finalAnswer: null,
  };
}

function commitCurrentAnswer(
  state: StreamReplyState,
  effects: StreamReplyEffect[],
): StreamReplyState {
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

function openAnswerSegment(
  state: StreamReplyState,
  effects: StreamReplyEffect[],
): StreamReplyState {
  if (state.activeSegmentId != null) return state;
  const segmentId = state.nextSegmentId;
  effects.push({ kind: "answer_open", segmentId });
  return {
    ...state,
    activeSegmentId: segmentId,
    nextSegmentId: segmentId + 1,
    phase: "answer_streaming",
  };
}

function flushToolRound(
  state: StreamReplyState,
  buffer: ToolRoundBuffer,
  effects: StreamReplyEffect[],
): StreamReplyState {
  const calls = buffer.take();
  if (calls.length === 0) return state;
  let next = commitCurrentAnswer(state, effects);
  effects.push({ kind: "tool_round", calls });
  next = { ...next, phase: "idle" };
  return next;
}

function appendClarify(
  state: StreamReplyState,
  data: StreamEvent & { event: "awaiting_clarify" },
  effects: StreamReplyEffect[],
): StreamReplyState {
  effects.push({
    kind: "clarify",
    items: data.data.items,
    timeout_sec: data.data.timeout_sec,
  });
  return state;
}

function finalizeAnswer(state: StreamReplyState, effects: StreamReplyEffect[]): StreamReplyState {
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

export function applyStreamReplyEvent(
  state: StreamReplyState,
  event: StreamEvent,
  buffer: ToolRoundBuffer,
): ApplyStreamReplyResult {
  if (state.phase === "terminal") {
    return { state, effects: [] };
  }

  const effects: StreamReplyEffect[] = [];
  let next = state;

  switch (event.event) {
    case "token": {
      next = flushToolRound(next, buffer, effects);
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
      next = flushToolRound(next, buffer, effects);
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
      next = flushToolRound(next, buffer, effects);
      next = commitCurrentAnswer(next, effects);
      next = appendClarify(next, event, effects);
      break;
    }
    case "tool_begin": {
      next = commitCurrentAnswer(next, effects);
      buffer.addBegin(event.data.name, event.data.args);
      next = { ...next, phase: "tool_collecting" };
      break;
    }
    case "tool_result":
      buffer.addResult(event.data.name, event.data.content);
      break;
    case "tool_error":
      buffer.addError(event.data.content);
      break;
    case "tool_round_end": {
      next = flushToolRound(next, buffer, effects);
      break;
    }
    case "error": {
      next = flushToolRound(next, buffer, effects);
      next = finalizeAnswer(next, effects);
      effects.push({ kind: "turn_end", reason: "error", message: event.data.error });
      next = {
        ...next,
        terminal: { kind: "error", message: event.data.error },
      };
      break;
    }
    case "interrupted": {
      next = flushToolRound(next, buffer, effects);
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
      next = flushToolRound(next, buffer, effects);
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

export async function reduceStreamReplyEvents(
  events: AsyncIterable<StreamEvent>,
): Promise<{ state: StreamReplyState; effects: StreamReplyEffect[] }> {
  let state = initialStreamReplyState();
  const allEffects: StreamReplyEffect[] = [];
  const buffer = new ToolRoundBuffer();

  for await (const event of events) {
    const result = applyStreamReplyEvent(state, event, buffer);
    state = result.state;
    allEffects.push(...result.effects);
    if (state.phase === "terminal") break;
  }

  if (state.phase !== "terminal") {
    const tailEffects: StreamReplyEffect[] = [];
    state = flushToolRound(state, buffer, tailEffects);
    allEffects.push(...tailEffects);
    const finEffects: StreamReplyEffect[] = [];
    state = finalizeAnswer(state, finEffects);
    allEffects.push(...finEffects);
    allEffects.push({ kind: "turn_end", reason: "done" });
    state = { ...state, terminal: { kind: "done" } };
  }

  return { state, effects: allEffects };
}
