import type { StreamEvent } from "@freeanima/runtime/loop";
import {
  ToolRoundBuffer,
  applyStreamReplyEvent,
  initialStreamReplyState as coreInitialStreamReplyState,
  type StreamReplyEffect,
} from "@freeanima/runtime/loop/stream-reply";
import type { ApplyStreamEventResult, StreamEffect, StreamReplyState } from "./types.ts";
import { formatClarifyForPlatform } from "../clarify/index.ts";
import { formatStructuredToolRound } from "../stream-tool-format.ts";
import type { ToolDisplayMode } from "../tool-display.ts";
import { DEFAULT_TOOL_DISPLAY_MODE } from "../tool-display.ts";

export type StreamReducePlatform = "discord" | "weixin" | "parlor";

export function initialStreamReplyState(): StreamReplyState {
  return {
    ...coreInitialStreamReplyState(),
    visibleBlocks: [],
  };
}

function mapReplyEffectsToGateway(
  effects: StreamReplyEffect[],
  platform: StreamReducePlatform,
  toolDisplayMode: ToolDisplayMode,
  state: StreamReplyState,
): { effects: StreamEffect[]; state: StreamReplyState } {
  const out: StreamEffect[] = [];
  let next = state;

  for (const effect of effects) {
    switch (effect.kind) {
      case "tool_round": {
        const text = formatStructuredToolRound(effect.calls, toolDisplayMode);
        if (text) {
          out.push({ kind: "tool_round", text });
          next = { ...next, visibleBlocks: [...next.visibleBlocks, text] };
        }
        break;
      }
      case "clarify": {
        const text = formatClarifyForPlatform(platform, {
          items: effect.items,
          timeout_sec: effect.timeout_sec,
        });
        out.push({ kind: "clarify", text });
        next = { ...next, visibleBlocks: [...next.visibleBlocks, text] };
        break;
      }
      case "answer_open":
      case "answer_delta":
      case "answer_replace":
      case "answer_commit":
      case "answer_finalize":
      case "turn_end":
        out.push(effect);
        break;
    }
  }

  return { effects: out, state: next };
}

export function applyStreamEvent(
  state: StreamReplyState,
  event: StreamEvent,
  platform: StreamReducePlatform,
  buffer: ToolRoundBuffer,
  toolDisplayMode: ToolDisplayMode = DEFAULT_TOOL_DISPLAY_MODE,
): ApplyStreamEventResult {
  const { state: coreState, effects } = applyStreamReplyEvent(
    {
      phase: state.phase,
      segments: state.segments,
      currentAnswer: state.currentAnswer,
      activeSegmentId: state.activeSegmentId,
      nextSegmentId: state.nextSegmentId,
      finalAnswer: state.finalAnswer,
      terminal: state.terminal,
    },
    event,
    buffer,
  );

  const mapped = mapReplyEffectsToGateway(effects, platform, toolDisplayMode, {
    ...coreState,
    visibleBlocks: state.visibleBlocks,
  });

  return mapped;
}

export async function reduceStreamEvents(
  events: AsyncIterable<StreamEvent>,
  platform: StreamReducePlatform = "parlor",
  toolDisplayMode: ToolDisplayMode = DEFAULT_TOOL_DISPLAY_MODE,
): Promise<{ state: StreamReplyState; effects: StreamEffect[] }> {
  let state = initialStreamReplyState();
  const allEffects: StreamEffect[] = [];
  const buffer = new ToolRoundBuffer();

  for await (const event of events) {
    const result = applyStreamEvent(state, event, platform, buffer, toolDisplayMode);
    state = result.state;
    allEffects.push(...result.effects);
    if (state.phase === "terminal") break;
  }

  if (state.phase !== "terminal") {
    const result = applyStreamEvent(
      state,
      { event: "done", data: {} },
      platform,
      buffer,
      toolDisplayMode,
    );
    state = result.state;
    allEffects.push(...result.effects);
  }

  return { state, effects: allEffects };
}
