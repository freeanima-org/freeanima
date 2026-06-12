export type RunSimpleTurnOpts = {
  sessionId: string;
  prompt: string;
  model: string;
};

export type RunSimpleTurnFn = (opts: RunSimpleTurnOpts) => Promise<string>;

let runSimpleTurnImpl: RunSimpleTurnFn | null = null;

export function registerRunSimpleTurn(fn: RunSimpleTurnFn): void {
  runSimpleTurnImpl = fn;
}

export function unregisterRunSimpleTurn(): void {
  runSimpleTurnImpl = null;
}

/** Non-streaming full turn for cron / scripts; implementation registered by @freeanima/platform at startup */
export async function runSimpleTurn(opts: RunSimpleTurnOpts): Promise<string> {
  if (!runSimpleTurnImpl) {
    throw new Error("runSimpleTurn not registered: load @freeanima/platform first");
  }
  return runSimpleTurnImpl(opts);
}
