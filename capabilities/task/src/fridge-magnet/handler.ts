import type { BeforeLlmCallContext } from "@freeanima/core/hooks/loop";
import { FRIDGE_MAGNET_SCAN_PATTERN, scanMagnets, stripMagnetRedisKeyPrefix } from "./store.ts";
import { manifestFridgeMagnetBoard, stripFridgeContextFromMessages } from "./inject.ts";
import type { FridgeMagnet } from "./types.ts";

function toDisplayMagnets(hits: { key: string; value: string }[]): FridgeMagnet[] {
  return hits.map(({ key, value }) => ({
    key: stripMagnetRedisKeyPrefix(key),
    value,
  }));
}

export function createFridgeMagnetHandler() {
  return async (ctx: BeforeLlmCallContext): Promise<void> => {
    stripFridgeContextFromMessages(ctx.messages);

    const lastMsg = ctx.messages[ctx.messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") return;

    const hits = await scanMagnets(FRIDGE_MAGNET_SCAN_PATTERN);
    const magnets = toDisplayMagnets(hits).filter((m) => m.value.trim().length > 0);
    if (magnets.length === 0) return;

    manifestFridgeMagnetBoard(ctx.messages, magnets);
  };
}
