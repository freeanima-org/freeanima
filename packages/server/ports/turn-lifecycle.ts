import { platformPorts } from "./service.ts";

export type RunSimpleTurnOpts = {
  conversationId: string;
  prompt: string;
  model: string;
};

export type RunSimpleTurnFn = (opts: RunSimpleTurnOpts) => Promise<string>;

/** Composition root binds the implementation onto `ctx.platformPorts`. */
export function registerRunSimpleTurn(fn: RunSimpleTurnFn): void {
  platformPorts().runSimpleTurn = fn;
}

export function unregisterRunSimpleTurn(): void {
  platformPorts().runSimpleTurn = null;
}

/** Non-streaming full turn for cron / scripts; bound by the server composition root */
export async function runSimpleTurn(opts: RunSimpleTurnOpts): Promise<string> {
  const fn = platformPorts().runSimpleTurn;
  if (!fn) {
    throw new Error("runSimpleTurn not registered: load @freeanima/server first");
  }
  return fn(opts);
}
