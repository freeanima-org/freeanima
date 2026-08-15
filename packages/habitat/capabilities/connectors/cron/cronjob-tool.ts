import { omitUndefined } from "@freeanima/habitat/core/util";
import type { ToolArgs, ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/habitat/core/tool";
import { CRON_TOOL_RETURNS } from "./return-schemas.ts";
import { computeNextRunAt } from "./bun-schedule.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  createJob,
  getJob,
  listJobs,
  pauseJob,
  removeJob,
  resumeJob,
  enqueueRunJob,
} from "./index.ts";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function tsHuman(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function requireJobId(args: ToolArgs): string | null {
  const jobId = coerceString(args.job_id ?? "").trim();
  return jobId || null;
}

async function handleList(): Promise<string> {
  const jobs = await listJobs();
  return toolResult({
    ok: true as const,
    count: jobs.length,
    jobs: jobs.map((j) => ({
      id: j.id,
      name: j.name,
      schedule: j.schedule,
      paused: j.paused,
      run_count: j.run_count,
      next_run: tsHuman(computeNextRunAt(j.schedule, j.paused) ?? 0),
      summary: `${j.paused ? "paused" : "active"} · ${j.name} · ${j.schedule}`,
    })),
    message: jobs.length > 0 ? `Total ${jobs.length} scheduled jobs` : "No scheduled jobs",
  });
}

async function handleGet(args: ToolArgs): Promise<string> {
  const jobId = requireJobId(args);
  if (!jobId) return toolError("job_id required");
  const j = await getJob(jobId);
  if (!j) return toolError(`Job not found: ${jobId}`);
  const json = j.toJSON({ includeOutput: true });
  return toolResult({
    ok: true as const,
    job: {
      id: j.id,
      name: j.name,
      schedule: j.schedule,
      paused: j.paused,
      run_count: j.run_count,
      repeat: j.repeat,
      last_run_at: j.last_run_at ? tsHuman(j.last_run_at) : null,
      next_run_at: json.next_run_at > 0 ? tsHuman(json.next_run_at) : null,
      skills: j.skills,
      script: j.script,
      last_output: json.last_output ?? null,
      notify_on_success: j.notify_on_success,
    },
  });
}

async function handleCreate(args: ToolArgs): Promise<string> {
  const name = coerceString(args.name ?? "");
  const schedule = coerceString(args.schedule ?? "");
  const prompt = coerceString(args.prompt ?? "");
  const noAgent = Boolean(args.no_agent);
  if (!name) return toolError("name required to create job");
  if (!schedule) return toolError("schedule required to create job");
  if (!prompt && !noAgent)
    return toolError("prompt required to create job (or no_agent=true for script-only mode)");
  try {
    const j = await createJob(
      omitUndefined({
        name,
        schedule,
        prompt,
        skills: Array.isArray(args.skills) ? (args.skills as string[]) : undefined,
        script: args.script != null ? coerceString(args.script) : null,
        no_agent: noAgent,
        repeat: typeof args.repeat === "number" ? args.repeat : null,
        notify_on_success: Boolean(args.notify_on_success),
      }),
    );
    const next = computeNextRunAt(j.schedule, j.paused) ?? 0;
    return toolResult({
      ok: true as const,
      job_id: j.id,
      name: j.name,
      schedule: j.schedule,
      next_run: next > 0 ? tsHuman(next) : null,
      message: `Created job ${j.name}`,
    });
  } catch (e) {
    return toolError(`Create failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function handleRemove(args: ToolArgs): Promise<string> {
  const jobId = requireJobId(args);
  if (!jobId) return toolError("job_id required");
  try {
    const ok = await removeJob(jobId);
    if (!ok) return toolError(`Not found ${jobId}`);
    return toolResult({ ok: true as const, job_id: jobId, message: `Deleted ${jobId}` });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handlePause(args: ToolArgs): Promise<string> {
  const jobId = requireJobId(args);
  if (!jobId) return toolError("job_id required");
  const ok = await pauseJob(jobId);
  if (!ok) return toolError(`Not found ${jobId}`);
  return toolResult({ ok: true as const, job_id: jobId, message: `Paused ${jobId}` });
}

async function handleResume(args: ToolArgs): Promise<string> {
  const jobId = requireJobId(args);
  if (!jobId) return toolError("job_id required");
  const ok = await resumeJob(jobId);
  if (!ok) return toolError(`Not found ${jobId}`);
  return toolResult({ ok: true as const, job_id: jobId, message: `Resumed ${jobId}` });
}

async function handleRun(args: ToolArgs): Promise<string> {
  const jobId = requireJobId(args);
  if (!jobId) return toolError("job_id required");
  const j = await getJob(jobId);
  if (!j) return toolError(`Not found ${jobId}`);
  void enqueueRunJob(j);
  return toolResult({
    ok: true as const,
    job_id: j.id,
    name: j.name,
    message: `Triggered immediate run: ${j.name}`,
  });
}

const JOB_ID_PARAM = {
  job_id: { type: "string" as const, description: "Job ID" },
};

export function registerCronjobTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "cronjob",
    "Scheduled job management",
    attachToolReturns(
      [
        {
          name: "cronjob_list",
          description: "List scheduled cron jobs",
          parameters: { type: "object", properties: {} },
          handler: () => handleList(),
        },
        {
          name: "cronjob_get",
          description: "Get a scheduled cron job by id",
          parameters: {
            type: "object",
            properties: JOB_ID_PARAM,
            required: ["job_id"],
          },
          handler: (args) => handleGet(args),
        },
        {
          name: "cronjob_create",
          description:
            "Create a scheduled job. Provide prompt for LLM runs, or no_agent=true with script for script-only mode.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Job name" },
              schedule: {
                type: "string",
                description: "Schedule expression (e.g. 30m, every 2h, 0 9 * * *, ISO timestamp)",
              },
              prompt: {
                type: "string",
                description: "LLM prompt (required unless no_agent)",
              },
              skills: { type: "array", items: { type: "string" }, description: "Skills to load" },
              script: { type: "string", description: "Script path (relative to cron/scripts)" },
              no_agent: { type: "boolean", description: "Script-only mode, no LLM" },
              repeat: { type: "integer", description: "Max run count" },
              notify_on_success: {
                type: "boolean",
                description:
                  "Send job output to notification inbox on success (default false; failures always notify)",
              },
            },
            required: ["name", "schedule"],
          },
          handler: (args) => handleCreate(args),
        },
        {
          name: "cronjob_remove",
          description: "Delete a scheduled cron job (built-in jobs cannot be removed)",
          parameters: {
            type: "object",
            properties: JOB_ID_PARAM,
            required: ["job_id"],
          },
          handler: (args) => handleRemove(args),
        },
        {
          name: "cronjob_pause",
          description: "Pause a scheduled cron job",
          parameters: {
            type: "object",
            properties: JOB_ID_PARAM,
            required: ["job_id"],
          },
          handler: (args) => handlePause(args),
        },
        {
          name: "cronjob_resume",
          description: "Resume a paused cron job",
          parameters: {
            type: "object",
            properties: JOB_ID_PARAM,
            required: ["job_id"],
          },
          handler: (args) => handleResume(args),
        },
        {
          name: "cronjob_run",
          description: "Trigger an immediate run of a cron job",
          parameters: {
            type: "object",
            properties: JOB_ID_PARAM,
            required: ["job_id"],
          },
          handler: (args) => handleRun(args),
        },
      ],
      CRON_TOOL_RETURNS,
    ),
  );
}
