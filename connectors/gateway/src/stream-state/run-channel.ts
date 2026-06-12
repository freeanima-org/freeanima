import type { StreamEvent } from "@freeanima/orchestration-loop";
import { ToolRoundCollector } from "../stream-tool-format.ts";
import type { StreamChannelComposer } from "../stream-strategies/composer.ts";
import { applyStreamEvent, initialStreamReplyState, type StreamReducePlatform } from "./reducer.ts";

export type RunStreamChannelOptions = {
  platform?: StreamReducePlatform;
  signal?: AbortSignal;
  /** WebUI：在 reducer 前透传原始 StreamEvent */
  onRawEvent?: (event: StreamEvent) => Promise<void> | void;
};

export async function runStreamChannel(
  events: AsyncIterable<StreamEvent>,
  composer: StreamChannelComposer,
  opts?: RunStreamChannelOptions,
): Promise<void> {
  const platform = opts?.platform ?? "parlor";
  let state = initialStreamReplyState();
  const collector = new ToolRoundCollector();

  try {
    for await (const event of events) {
      if (opts?.signal?.aborted) break;

      if (event.event === "accepted") {
        await opts?.onRawEvent?.(event);
        continue;
      }

      await opts?.onRawEvent?.(event);

      const { state: next, effects } = applyStreamEvent(state, event, platform, collector);
      state = next;
      for (const effect of effects) {
        if (opts?.signal?.aborted) break;
        await composer.dispatch(effect, state);
        if (effect.kind === "turn_end" && effect.reason === "error") {
          throw new Error(effect.message ?? "stream error");
        }
      }
      if (state.phase === "terminal") break;
    }
    await composer.flush();
  } finally {
    await composer.dispose();
  }
}
