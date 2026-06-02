import { registerTool } from "@freeanima/legacy-kernel";
import { createJob, getJob, listJobs, pauseJob, removeJob, resumeJob, enqueueRunJob } from "@freeanima/legacy-runtime";


function tsHuman(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function handleCronjob(args: Record<string, unknown>): string {
  const action = String(args.action ?? "list");
  const jobId = String(args.job_id ?? "");

  if (action === "list") {
    const jobs = listJobs();
    if (!jobs.length) return "📭 没有定时任务";
    const lines = [`**定时任务 (${jobs.length})**\n`];
    for (const j of jobs) {
      const status = j.paused ? "⏸" : "⏰";
      const scheduleShort = j.schedule.slice(0, 20);
      const nextRun = j.next_run_at > 0 ? tsHuman(j.next_run_at) : "";
      const nameShort = j.name.slice(0, 24);
      lines.push(
        `  ${status} \`${j.id.slice(0, 12)}\` **${nameShort}** [${scheduleShort}] (${j.run_count}次) → ${nextRun}`,
      );
    }
    return lines.join("\n");
  }

  if (action === "get") {
    if (!jobId) return "⚠️ 需要 job_id";
    const j = getJob(jobId);
    if (!j) return `❌ 未找到 job: ${jobId}`;
    return [
      `**${j.name}** (\`${j.id}\`)`,
      `  调度: ${j.schedule}`,
      `  状态: ${j.paused ? "⏸ 暂停" : "⏰ 活跃"}`,
      `  运行: ${j.run_count} 次${j.repeat != null ? `/${j.repeat}` : ""}`,
      j.last_run_at ? `  上次: ${tsHuman(j.last_run_at)}` : "",
      j.next_run_at > 0 ? `  下次: ${tsHuman(j.next_run_at)}` : "",
      j.skills.length ? `  技能: ${j.skills.join(", ")}` : "",
      j.script ? `  脚本: ${j.script}` : "",
      `  投递: ${j.deliver}`,
      j.last_output
        ? j.last_output.length > 300
          ? `  输出: ${j.last_output.slice(0, 300)}...`
          : `  输出: ${j.last_output}`
        : "  (无输出)",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (action === "create") {
    const name = String(args.name ?? "");
    const schedule = String(args.schedule ?? "");
    const prompt = String(args.prompt ?? "");
    const noAgent = Boolean(args.no_agent);
    if (!name) return "⚠️ 创建任务需要 name";
    if (!schedule) return "⚠️ 创建任务需要 schedule";
    if (!prompt && !noAgent) return "⚠️ 创建任务需要 prompt（或 no_agent=true 仅脚本模式）";
    try {
      const j = createJob({
        name,
        schedule,
        prompt,
        skills: Array.isArray(args.skills) ? (args.skills as string[]) : undefined,
        script: args.script != null ? String(args.script) : null,
        no_agent: noAgent,
        deliver: String(args.deliver ?? "local"),
        repeat: typeof args.repeat === "number" ? args.repeat : null,
      });
      return `✅ 已创建任务 \`${j.id}\` — ${j.name}\n  调度: ${j.schedule}\n  下次: ${j.next_run_at > 0 ? tsHuman(j.next_run_at) : "—"}`;
    } catch (e) {
      return `❌ 创建失败: ${e}`;
    }
  }

  if (action === "remove") {
    if (!jobId) return "⚠️ 需要 job_id";
    try {
      return removeJob(jobId) ? `✅ 已删除 ${jobId}` : `❌ 未找到 ${jobId}`;
    } catch (e) {
      return `❌ ${e}`;
    }
  }

  if (action === "pause") {
    if (!jobId) return "⚠️ 需要 job_id";
    return pauseJob(jobId) ? `⏸ 已暂停 ${jobId}` : `❌ 未找到 ${jobId}`;
  }

  if (action === "resume") {
    if (!jobId) return "⚠️ 需要 job_id";
    return resumeJob(jobId) ? `⏰ 已恢复 ${jobId}` : `❌ 未找到 ${jobId}`;
  }

  if (action === "run") {
    if (!jobId) return "⚠️ 需要 job_id";
    const j = getJob(jobId);
    if (!j) return `❌ 未找到 ${jobId}`;
    void enqueueRunJob(j);
    return `▶️ 已触发立即运行: ${j.name} (\`${j.id.slice(0, 12)}\`)`;
  }

  return `❌ 未知 action: ${action}`;
}

export function registerCronjobTool(): void {
  registerTool({
    name: "cronjob",
    description: "管理定时任务：创建、列表、查看、暂停、恢复、删除、立即运行",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "list", "get", "remove", "pause", "resume", "run"],
          description: "操作类型",
        },
        job_id: { type: "string", description: "任务 ID（get/remove/pause/resume/run 需要）" },
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
    handler: handleCronjob,
  });
}
