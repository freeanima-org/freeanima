import type { BeforeLlmCallContext } from "@freeanima/kernel-hooks";
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

    const sessionPattern = `fridge:session:${ctx.sessionId}:*`;
    const tasksPattern = "fridge:tasks:*";
    const [sessionHits, taskHits] = await Promise.all([
      scanMagnets(sessionPattern),
      scanMagnets(tasksPattern),
    ]);
    const magnets = toDisplayMagnets([...sessionHits, ...taskHits]);
    if (magnets.length === 0) return;

    injectIntoMessages(ctx.messages, magnets);
  };
}
