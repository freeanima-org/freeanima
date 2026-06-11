import type { BeforeLlmCallContext } from "@freeanima/engine-hooks/loop";
import { scanMagnets } from "./store.ts";
import { stripAllFromMessages, injectIntoMessages } from "./inject.ts";
import type { FridgeMagnet } from "./types.ts";

function toDisplayMagnets(hits: { key: string; value: string }[]): FridgeMagnet[] {
  return hits.map(({ key, value }) => ({
    key: key.startsWith("fridge:") ? key.slice("fridge:".length) : key,
    value,
  }));
}

export function createFridgeMagnetHandler() {
  return async (ctx: BeforeLlmCallContext): Promise<void> => {
    stripAllFromMessages(ctx.messages);

    const lastMsg = ctx.messages[ctx.messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") return;

    const hits = await scanMagnets("fridge:*");
    const magnets = toDisplayMagnets(hits);
    if (magnets.length === 0) return;

    injectIntoMessages(ctx.messages, magnets);
  };
}
