import { omitUndefined } from "@freeanima/core/util";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/core/tool";
import { CRON_TOOL_RETURNS } from "./return-schemas.ts";
import { computeNextRunAt } from "./bun-schedule.ts";
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

async function handleCronjob(args: Record<string, unknown>): Promise<string> {
  const action = String(args.action ?? "list");
  const jobId = String(args.job_id ?? "");

  if (action === "list") {
    const jobs = await listJobs();
    return toolResult({
      ok: true,
      action: "list",
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

  if (action === "get") {
    if (!jobId) return toolError("job_id required");
    const j = await getJob(jobId);
    if (!j) return toolError(`Job not found: ${jobId}`);
    const json = j.toJSON({ includeOutput: true });
    return toolResult({
      ok: true,
      action: "get",
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

  if (action === "create") {
    const name = String(args.name ?? "");
    const schedule = String(args.schedule ?? "");
    const prompt = String(args.prompt ?? "");
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
          script: args.script != null ? String(args.script) : null,
          no_agent: noAgent,
          repeat: typeof args.repeat === "number" ? args.repeat : null,
          notify_on_success: Boolean(args.notify_on_success),
        }),
      );
      const next = computeNextRunAt(j.schedule, j.paused) ?? 0;
      return toolResult({
        ok: true,
        action: "create",
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

  if (action === "remove") {
    if (!jobId) return toolError("job_id required");
    try {
      const ok = await removeJob(jobId);
      if (!ok) return toolError(`Not found ${jobId}`);
      return toolResult({ ok: true, action: "remove", job_id: jobId, message: `Deleted ${jobId}` });
    } catch (e) {
      return toolError(String(e instanceof Error ? e.message : e));
    }
  }

  if (action === "pause") {
    if (!jobId) return toolError("job_id required");
    const ok = await pauseJob(jobId);
    if (!ok) return toolError(`Not found ${jobId}`);
    return toolResult({ ok: true, action: "pause", job_id: jobId, message: `Paused ${jobId}` });
  }

  if (action === "resume") {
    if (!jobId) return toolError("job_id required");
    const ok = await resumeJob(jobId);
    if (!ok) return toolError(`Not found ${jobId}`);
    return toolResult({ ok: true, action: "resume", job_id: jobId, message: `Resumed ${jobId}` });
  }

  if (action === "run") {
    if (!jobId) return toolError("job_id required");
    const j = await getJob(jobId);
    if (!j) return toolError(`Not found ${jobId}`);
    void enqueueRunJob(j);
    return toolResult({
      ok: true,
      action: "run",
      job_id: j.id,
      name: j.name,
      message: `Triggered immediate run: ${j.name}`,
    });
  }

  return toolError(`Unknown action: ${action}`);
}

export function registerCronjobTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "cron",
    "Scheduled job management",
    attachToolReturns(
      [
        {
          name: "cron_job",
          description: "Manage cron jobs: create, list, view, pause, resume, delete, run now",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["create", "list", "get", "remove", "pause", "resume", "run"],
                description: "Action type",
              },
              job_id: {
                type: "string",
                description: "Job ID (required for get/remove/pause/resume/run)",
              },
              name: { type: "string", description: "Job name (required for create)" },
              schedule: {
                type: "string",
                description: "Schedule expression (required for create)",
              },
              prompt: {
                type: "string",
                description: "LLM prompt (required for create, unless no_agent)",
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
            required: ["action"],
          },
          handler: (args) => handleCronjob(args),
        },
      ],
      CRON_TOOL_RETURNS,
    ),
  );
}
