import type { ActionRowBuilder, ButtonBuilder } from "discord.js";

import type { ToolDisplayMode } from "../tool-display.ts";
import type { StreamEffect } from "../stream-state/types.ts";
import {
  buildClarifyActionRows,
  canRenderClarifyButtons,
  formatClarifyDiscordContentForButtons,
} from "../discord/discord-clarify-components.ts";
import { createToolRoundStrategy } from "./tool-round.ts";
import type { StreamStrategy } from "./types.ts";

export type DiscordClarifySend = (
  content: string,
  rows: ActionRowBuilder<ButtonBuilder>[],
  timeoutSec: number,
) => Promise<void>;

export function createDiscordGatewayToolRoundStrategy(
  sendText: (text: string) => Promise<void>,
  sendClarifyWithComponents: DiscordClarifySend,
  mode: ToolDisplayMode,
  sessionId?: string,
): StreamStrategy {
  const base = createToolRoundStrategy();
  const baseHandle = base.handle.bind(base);
  return {
    name: "discord-gateway-tool-round",
    async handle(effect: StreamEffect, ctx) {
      if (effect.kind === "tool_round" && mode === "hidden") return [];
      if (effect.kind === "tool_round") {
        const actions = await baseHandle(effect, ctx);
        for (const action of actions) {
          if (action.op === "send") await sendText(action.text);
        }
        return [];
      }
      if (effect.kind === "clarify") {
        if (
          sessionId &&
          canRenderClarifyButtons({ items: effect.items, timeout_sec: effect.timeout_sec })
        ) {
          const item = effect.items[0]!;
          const content = formatClarifyDiscordContentForButtons({
            items: effect.items,
            timeout_sec: effect.timeout_sec,
          });
          const rows = buildClarifyActionRows(sessionId, item);
          await sendClarifyWithComponents(content, rows, effect.timeout_sec);
          return [];
        }
        await sendText(effect.text);
        return [];
      }
      return [];
    },
  };
}
