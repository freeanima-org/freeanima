import { cronJobDataSchema, type CronJobData } from "@freeanima/kernel";
import { safeParseOrNull } from "@freeanima/kernel";

export type { CronJobData };

export class CronJob {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  skills: string[];
  script: string | null;
  no_agent: boolean;
  enabled_toolsets: string[] | null;
  model_provider: string | null;
  model_name: string | null;
  workdir: string | null;
  context_from: string[];
  deliver: string;
  timeout_sec: number;
  builtin: boolean;
  repeat: number | null;
  run_count: number;
  paused: boolean;
  created_at: string;
  updated_at: string;
  next_run_at: number;
  last_run_at: number;
  last_output: string;

  constructor(init: Partial<CronJobData> & Pick<CronJobData, "id" | "name" | "schedule">) {
    this.id = init.id;
    this.name = init.name;
    this.schedule = init.schedule;
    this.prompt = init.prompt ?? "";
    this.skills = init.skills ?? [];
    this.script = init.script ?? null;
    this.no_agent = init.no_agent ?? false;
    this.enabled_toolsets = init.enabled_toolsets ?? null;
    this.model_provider = init.model_provider ?? null;
    this.model_name = init.model_name ?? null;
    this.workdir = init.workdir ?? null;
    this.context_from = init.context_from ?? [];
    this.deliver = init.deliver ?? "local";
    this.timeout_sec = init.timeout_sec ?? 300;
    this.builtin = init.builtin ?? false;
    this.repeat = init.repeat ?? null;
    this.run_count = init.run_count ?? 0;
    this.paused = init.paused ?? false;
    this.created_at = init.created_at ?? "";
    this.updated_at = init.updated_at ?? "";
    this.next_run_at = init.next_run_at ?? 0;
    this.last_run_at = init.last_run_at ?? 0;
    this.last_output = init.last_output ?? "";
  }

  toJSON(): CronJobData {
    return {
      id: this.id,
      name: this.name,
      schedule: this.schedule,
      prompt: this.prompt,
      skills: [...this.skills],
      script: this.script,
      no_agent: this.no_agent,
      enabled_toolsets: this.enabled_toolsets ? [...this.enabled_toolsets] : null,
      model_provider: this.model_provider,
      model_name: this.model_name,
      workdir: this.workdir,
      context_from: [...this.context_from],
      deliver: this.deliver,
      timeout_sec: this.timeout_sec,
      builtin: this.builtin,
      repeat: this.repeat,
      run_count: this.run_count,
      paused: this.paused,
      created_at: this.created_at,
      updated_at: this.updated_at,
      next_run_at: this.next_run_at,
      last_run_at: this.last_run_at,
      last_output: this.last_output,
    };
  }

  static fromJSON(data: Record<string, unknown>): CronJob {
    const parsed = safeParseOrNull(cronJobDataSchema, data);
    if (!parsed) {
      throw new Error("invalid cron job data");
    }
    return new CronJob(parsed);
  }
}
