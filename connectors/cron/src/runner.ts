import { existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { getServiceContext } from "@freeanima/service";
import * as conv from "@freeanima/engine-conversation";
import { distillFromPg, l2SessionPath } from "@freeanima/life-memory/clean";
import { indexL2Session } from "@freeanima/life-memory/l2-indexer";
import { getProfileHopModel, loadConfig } from "@freeanima/service-config";
import { logComponent } from "@freeanima/service-logging";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import { loadSkill } from "@freeanima/life-memory";
import { runSimpleTurn } from "@freeanima/service-api/turn-lifecycle";
import type { CronJob } from "./models.ts";
import * as store from "./store.ts";
import { computeNextRun } from "./schedule.ts";
import { deliverCronResult } from "./deliver.ts";

/** 任务失败后最短重试间隔（秒），避免调度器每 10s 重复执行同一失败任务 */
const FAILURE_RETRY_DELAY_SEC = 300;

function conversation() {
  return getServiceContext().conversation;
}

export async function runL2GapFill(): Promise<string> {
  let count = 0;
  const sessionStore = conversation().repos.session;
  for (const sid of await conversation().listSessions()) {
    if (existsSync(l2SessionPath(sid))) continue;
    const result = await distillFromPg(sessionStore, sid);
    if (result) {
      count += 1;
      indexL2Session(sid);
    }
  }
  return count ? `L2 gap-fill: ${count} session(s) distilled and indexed` : "";
}

function runScript(scriptPath: string, timeoutSec: number): string {
  const path = store.resolveScriptPath(scriptPath);
  if (!existsSync(path)) {
    throw new Error(`Script not found: ${path}`);
  }
  const timeoutMs = Math.max(1, timeoutSec) * 1000;
  const ext = path.toLowerCase().slice(path.lastIndexOf("."));
  const cmd =
    ext === ".sh" || ext === ".bash"
      ? spawnSync("bash", [path], { encoding: "utf-8", timeout: timeoutMs })
      : spawnSync("node", [path], { encoding: "utf-8", timeout: timeoutMs });

  if (cmd.error) throw cmd.error;
  if (cmd.status !== 0) {
    const stderr = (cmd.stderr ?? "").trim();
    const stdout = (cmd.stdout ?? "").trim();
    const detail = [stderr, stdout].filter(Boolean).join("\n").slice(0, 2000);
    throw new Error(`Script exited with code ${cmd.status}${detail ? `: ${detail}` : ""}`);
  }
  return (cmd.stdout ?? "").trim();
}

async function runEngine(job: CronJob, prompt: string): Promise<string> {
  const cfg = loadConfig();
  const model = job.model_name ?? getProfileHopModel(cfg, PROFILE_CHAT);
  const sid = conv.generateSessionId();
  await conversation().initSession(sid, model, { platform: "cron" });

  for (const skillName of job.skills) {
    loadSkill(skillName);
  }

  return runSimpleTurn({ sessionId: sid, prompt, model });
}

function saveOutput(job: CronJob, content: string): void {
  const outPath = store.outputPath(job.id, job.run_count);
  try {
    writeFileSync(outPath, content, "utf-8");
  } catch {
    /* ignore */
  }
}

function finalizeJob(job: CronJob, success: boolean): void {
  if (job.repeat != null && job.run_count >= job.repeat) {
    job.paused = true;
    job.next_run_at = 0;
  } else if (!success) {
    job.next_run_at = Date.now() / 1000 + FAILURE_RETRY_DELAY_SEC;
  } else {
    try {
      const next = computeNextRun(job.schedule, Date.now() / 1000);
      job.next_run_at = next ?? 0;
    } catch {
      job.paused = true;
      job.next_run_at = 0;
    }
  }
  store.update(job);
}

async function notifyDeliver(
  job: CronJob,
  success: boolean,
  output: string,
  error?: string,
): Promise<void> {
  try {
    await deliverCronResult(job, { jobName: job.name, success, output, error });
  } catch (e) {
    logComponent("cron").warn(`Cron deliver error for ${job.id}`, { err: e, job_id: job.id });
  }
}

/**
 * 下一事件循环再跑任务。runJob 内 no_agent 脚本用 spawnSync，若直接 void runJob()
 * 会在首个 await 之前阻塞调用方（HTTP /run 会卡满 timeout_sec）。
 */
export function enqueueRunJob(job: CronJob): Promise<void> {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      void runJob(job).then(resolve, reject);
    });
  });
}

export async function runJob(job: CronJob): Promise<void> {
  try {
    await runJobInternal(job);
  } catch (e) {
    const errText = String(e);
    job.last_output = `ERROR: ${errText}`;
    saveOutput(job, job.last_output);
    await notifyDeliver(job, false, job.last_output, errText);
    finalizeJob(job, false);
  }
}

async function runJobInternal(job: CronJob): Promise<void> {
  job.run_count += 1;
  job.last_run_at = Date.now() / 1000;
  // 长任务执行期间禁止调度器重入（spawnSync 阻塞时 runningIds 可能来不及生效）
  job.next_run_at = Date.now() / 1000 + (job.timeout_sec ?? 300);
  store.update(job);

  if (job.no_agent) {
    if (!job.script && job.id !== "l2-gap-fill") {
      throw new Error("no_agent=True requires a script");
    }
    const output =
      job.id === "l2-gap-fill" ? await runL2GapFill() : runScript(job.script!, job.timeout_sec);
    job.last_output = output;
    saveOutput(job, output);
    await notifyDeliver(job, true, output);
  } else {
    let context = "";
    if (job.script) context = runScript(job.script, job.timeout_sec);

    const chain: string[] = [];
    for (const upstreamId of job.context_from) {
      const upstream = store.find(upstreamId);
      if (upstream?.last_output) {
        chain.push(
          `--- Output from job ${upstream.name || upstreamId} ---\n${upstream.last_output}`,
        );
      }
    }

    let fullPrompt = job.prompt;
    const combined = [...chain, context].filter(Boolean).join("\n\n");
    if (combined) fullPrompt = `${combined}\n\n---\n\n${job.prompt}`;

    const output = await runEngine(job, fullPrompt);
    job.last_output = output.slice(0, 10_000);
    saveOutput(job, output);
    await notifyDeliver(job, true, job.last_output);
  }

  finalizeJob(job, true);
}
