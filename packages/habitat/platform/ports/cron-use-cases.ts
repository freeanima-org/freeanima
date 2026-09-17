import { platformPorts } from "./service.ts";

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

/** Composition root binds the implementation onto `ctx.platformPorts`. */
export function registerCronUseCases(port: { runCronEngineTurn: RunCronEngineTurnFn }): void {
  platformPorts().runCronEngineTurn = port.runCronEngineTurn;
}

export function unregisterCronUseCases(): void {
  platformPorts().runCronEngineTurn = null;
}

export async function runCronEngineTurn(job: CronEngineJobInput, prompt: string): Promise<string> {
  const fn = platformPorts().runCronEngineTurn;
  if (!fn) {
    throw new Error("runCronEngineTurn not registered: load @freeanima/habitat/platform first");
  }
  return fn(job, prompt);
}
