export type CronEngineJobInput = {
  model_name?: string | null;
  skills: string[];
};

export type RunCronEngineTurnFn = (job: CronEngineJobInput, prompt: string) => Promise<string>;

let runCronEngineTurnImpl: RunCronEngineTurnFn | null = null;

export function registerCronUseCases(port: { runCronEngineTurn: RunCronEngineTurnFn }): void {
  runCronEngineTurnImpl = port.runCronEngineTurn;
}

export function unregisterCronUseCases(): void {
  runCronEngineTurnImpl = null;
}

export async function runCronEngineTurn(job: CronEngineJobInput, prompt: string): Promise<string> {
  if (!runCronEngineTurnImpl) {
    throw new Error("runCronEngineTurn 未注册：请先加载 @freeanima/service");
  }
  return runCronEngineTurnImpl(job, prompt);
}
