export type CronEngineJobInput = {
  model_name?: string | null;
  skills: string[];
};

export type RunCronL2GapFillFn = () => Promise<string>;
export type RunCronEngineTurnFn = (job: CronEngineJobInput, prompt: string) => Promise<string>;

let runCronL2GapFillImpl: RunCronL2GapFillFn | null = null;
let runCronEngineTurnImpl: RunCronEngineTurnFn | null = null;

export function registerCronUseCases(port: {
  runCronL2GapFill: RunCronL2GapFillFn;
  runCronEngineTurn: RunCronEngineTurnFn;
}): void {
  runCronL2GapFillImpl = port.runCronL2GapFill;
  runCronEngineTurnImpl = port.runCronEngineTurn;
}

export function unregisterCronUseCases(): void {
  runCronL2GapFillImpl = null;
  runCronEngineTurnImpl = null;
}

export async function runCronL2GapFill(): Promise<string> {
  if (!runCronL2GapFillImpl) {
    throw new Error("runCronL2GapFill 未注册：请先加载 @freeanima/service");
  }
  return runCronL2GapFillImpl();
}

export async function runCronEngineTurn(job: CronEngineJobInput, prompt: string): Promise<string> {
  if (!runCronEngineTurnImpl) {
    throw new Error("runCronEngineTurn 未注册：请先加载 @freeanima/service");
  }
  return runCronEngineTurnImpl(job, prompt);
}
