export type CronEngineJobInput = {
  id?: string;
  name?: string;
  model_name?: string | null;
  skills: string[];
  allowed_tools?: string[];
  denied_tools?: string[];
  /** 行动主体；缺省由 runner 用 boot agent */
  subject_id?: number;
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
    throw new Error("runCronEngineTurn not registered: load @freeanima/platform first");
  }
  return runCronEngineTurnImpl(job, prompt);
}
