import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { attachToolReturns, toolError, toolResult } from "@freeanima/engine-tool";
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

function tsHuman(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
        summary: `${j.paused ? "暂停" : "活跃"} · ${j.name} · ${j.schedule}`,
      })),
      message: jobs.length ? `共 ${jobs.length} 个定时任务` : "没有定时任务",
    });
  }

  if (action === "get") {
    if (!jobId) return toolError("需要 job_id");
    const j = await getJob(jobId);
    if (!j) return toolError(`未找到 job: ${jobId}`);
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
        deliver: j.deliver,
        last_output: json.last_output ?? null,
      },
    });
  }

  if (action === "create") {
    const name = String(args.name ?? "");
    const schedule = String(args.schedule ?? "");
    const prompt = String(args.prompt ?? "");
    const noAgent = Boolean(args.no_agent);
    if (!name) return toolError("创建任务需要 name");
    if (!schedule) return toolError("创建任务需要 schedule");
    if (!prompt && !noAgent) return toolError("创建任务需要 prompt（或 no_agent=true 仅脚本模式）");
    try {
      const j = await createJob({
        name,
        schedule,
        prompt,
        skills: Array.isArray(args.skills) ? (args.skills as string[]) : undefined,
        script: args.script != null ? String(args.script) : null,
        no_agent: noAgent,
        deliver: String(args.deliver ?? "local"),
        repeat: typeof args.repeat === "number" ? args.repeat : null,
      });
      const next = computeNextRunAt(j.schedule, j.paused) ?? 0;
      return toolResult({
        ok: true,
        action: "create",
        job_id: j.id,
        name: j.name,
        schedule: j.schedule,
        next_run: next > 0 ? tsHuman(next) : null,
        message: `已创建任务 ${j.name}`,
      });
    } catch (e) {
      return toolError(`创建失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (action === "remove") {
    if (!jobId) return toolError("需要 job_id");
    try {
      const ok = await removeJob(jobId);
      if (!ok) return toolError(`未找到 ${jobId}`);
      return toolResult({ ok: true, action: "remove", job_id: jobId, message: `已删除 ${jobId}` });
    } catch (e) {
      return toolError(String(e instanceof Error ? e.message : e));
    }
  }

  if (action === "pause") {
    if (!jobId) return toolError("需要 job_id");
    const ok = await pauseJob(jobId);
    if (!ok) return toolError(`未找到 ${jobId}`);
    return toolResult({ ok: true, action: "pause", job_id: jobId, message: `已暂停 ${jobId}` });
  }

  if (action === "resume") {
    if (!jobId) return toolError("需要 job_id");
    const ok = await resumeJob(jobId);
    if (!ok) return toolError(`未找到 ${jobId}`);
    return toolResult({ ok: true, action: "resume", job_id: jobId, message: `已恢复 ${jobId}` });
  }

  if (action === "run") {
    if (!jobId) return toolError("需要 job_id");
    const j = await getJob(jobId);
    if (!j) return toolError(`未找到 ${jobId}`);
    void enqueueRunJob(j);
    return toolResult({
      ok: true,
      action: "run",
      job_id: j.id,
      name: j.name,
      message: `已触发立即运行: ${j.name}`,
    });
  }

  return toolError(`未知 action: ${action}`);
}

export function registerCronjobTool(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "cron",
    "定时任务管理",
    attachToolReturns(
      [
        {
          name: "cron_job",
          description: "管理定时任务：创建、列表、查看、暂停、恢复、删除、立即运行",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["create", "list", "get", "remove", "pause", "resume", "run"],
                description: "操作类型",
              },
              job_id: {
                type: "string",
                description: "任务 ID（get/remove/pause/resume/run 需要）",
              },
              name: { type: "string", description: "任务名称（create 需要）" },
              schedule: { type: "string", description: "调度表达式（create 需要）" },
              prompt: { type: "string", description: "LLM 提示词（create 需要，除非 no_agent）" },
              skills: { type: "array", items: { type: "string" }, description: "要加载的技能" },
              script: { type: "string", description: "脚本路径（相对 cron/scripts）" },
              no_agent: { type: "boolean", description: "仅脚本模式，不调用 LLM" },
              deliver: { type: "string", description: "投递目标，默认 local" },
              repeat: { type: "integer", description: "最大运行次数" },
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
