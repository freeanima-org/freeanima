import type { CronJobRow } from "@freeanima/core/db/pg/cron";
import { safeParseOrNull } from "@freeanima/core/util";
import { computeNextRunAt } from "./bun-schedule.ts";
import { readOutputRef } from "./paths.ts";
import { cronJobDataSchema, type CronJobData } from "./schema.ts";

export type { CronJobData };

export class CronJob {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  skills: string[];
  script: string | null;
  no_agent: boolean;
  model_provider: string | null;
  model_name: string | null;
  workdir: string | null;
  context_from: string[];
  timeout_sec: number;
  builtin: boolean;
  repeat: number | null;
  run_count: number;
  paused: boolean;
  created_at: string;
  updated_at: string;
  last_run_at: number;
  last_output_ref: string | null;
  notify_on_success: boolean;

  constructor(init: Partial<CronJobData> & Pick<CronJobData, "id" | "name" | "schedule">) {
    this.id = init.id;
    this.name = init.name;
    this.schedule = init.schedule;
    this.prompt = init.prompt ?? "";
    this.skills = init.skills ?? [];
    this.script = init.script ?? null;
    this.no_agent = init.no_agent ?? false;
    this.model_provider = init.model_provider ?? null;
    this.model_name = init.model_name ?? null;
    this.workdir = init.workdir ?? null;
    this.context_from = init.context_from ?? [];
    this.timeout_sec = init.timeout_sec ?? 300;
    this.builtin = init.builtin ?? false;
    this.repeat = init.repeat ?? null;
    this.run_count = init.run_count ?? 0;
    this.paused = init.paused ?? false;
    this.created_at = init.created_at ?? "";
    this.updated_at = init.updated_at ?? "";
    this.last_run_at = init.last_run_at ?? 0;
    this.last_output_ref = init.last_output_ref ?? null;
    this.notify_on_success = init.notify_on_success ?? false;
  }

  static fromRow(row: CronJobRow): CronJob {
    return new CronJob({
      id: row.id,
      name: row.name,
      schedule: row.schedule,
      prompt: row.prompt,
      skills: row.skills,
      script: row.script,
      no_agent: row.no_agent,
      model_provider: row.model_provider,
      model_name: row.model_name,
      workdir: row.workdir,
      context_from: row.context_from,
      timeout_sec: row.timeout_sec,
      builtin: row.builtin,
      repeat: row.repeat,
      run_count: row.run_count,
      paused: row.paused,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      last_run_at: row.last_run_at ? Math.floor(new Date(row.last_run_at).getTime() / 1000) : 0,
      last_output_ref: row.last_output_ref,
      notify_on_success: row.notify_on_success,
    });
  }

  toJSON(opts?: { includeOutput?: boolean }): CronJobData {
    const next = computeNextRunAt(this.schedule, this.paused) ?? 0;
    const lastOutput =
      opts?.includeOutput && this.last_output_ref ? readOutputRef(this.last_output_ref) : "";
    return {
      id: this.id,
      name: this.name,
      schedule: this.schedule,
      prompt: this.prompt,
      skills: [...this.skills],
      script: this.script,
      no_agent: this.no_agent,
      model_provider: this.model_provider,
      model_name: this.model_name,
      workdir: this.workdir,
      context_from: [...this.context_from],
      timeout_sec: this.timeout_sec,
      builtin: this.builtin,
      repeat: this.repeat,
      run_count: this.run_count,
      paused: this.paused,
      created_at: this.created_at,
      updated_at: this.updated_at,
      last_run_at: this.last_run_at,
      last_output_ref: this.last_output_ref,
      notify_on_success: this.notify_on_success,
      next_run_at: next,
      last_output: lastOutput.slice(0, 10_000),
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
