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

/** cron / 脚本等非流式整轮；实现由 @freeanima/service 在启动时注册 */
export async function runSimpleTurn(opts: RunSimpleTurnOpts): Promise<string> {
  if (!runSimpleTurnImpl) {
    throw new Error("runSimpleTurn 未注册：请先加载 @freeanima/service");
  }
  return runSimpleTurnImpl(opts);
}
