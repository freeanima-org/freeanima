import type { ToolDisplayMode } from "../tool-display.ts";
import type { StreamEffect } from "../stream-state/types.ts";
import { createToolRoundStrategy } from "./tool-round.ts";
import type { StreamStrategy } from "./types.ts";

/** IM 通道：工具轮次立即 send；hidden 时不发送 tool_round（clarify 仍发送） */
export function createGatewayToolRoundStrategy(
  send: (text: string) => Promise<void>,
  mode: ToolDisplayMode,
): StreamStrategy {
  const base = createToolRoundStrategy();
  const baseHandle = base.handle.bind(base);
  return {
    name: "gateway-tool-round",
    async handle(effect: StreamEffect, ctx) {
      if (effect.kind === "tool_round" && mode === "hidden") return [];
      if (effect.kind !== "tool_round" && effect.kind !== "clarify") return [];
      const actions = await baseHandle(effect, ctx);
      for (const action of actions) {
        if (action.op === "send") await send(action.text);
      }
      return [];
    },
  };
}
