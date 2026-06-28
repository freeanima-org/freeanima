import { existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { runCronEngineTurn } from "@freeanima/platform/ports/cron-use-cases";
import { logComponent } from "@freeanima/platform/logging";
import type { CronJob } from "./models.ts";
import { CronJob as CronJobClass } from "./models.ts";
import {
  fromOutputRef,
  outputPath,
  readOutputRef,
  resolveScriptPath,
  toOutputRef,
} from "./paths.ts";
import { deliverCronResult } from "./deliver.ts";
import { appendCronRunLog } from "./cron-log.ts";
import { runCronBuiltinHandler } from "./builtin-handlers.ts";
import { getCronHandleManager, isCronModuleInitialized, updateCronJobRow } from "./module.ts";
import { getCronJob } from "@freeanima/core/db/pg/cron";

function runScript(scriptPath: string, timeoutSec: number): string {
  const path = resolveScriptPath(scriptPath);
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

function saveOutput(job: CronJob, content: string): string {
  const outPath = outputPath(job.id, job.run_count);
  try {
    writeFileSync(outPath, content, "utf-8");
  } catch {
    /* ignore */
  }
  return toOutputRef(outPath);
}

async function persistJob(job: CronJob): Promise<void> {
  if (!isCronModuleInitialized()) return;
  await updateCronJobRow({
    id: job.id,
    run_count: job.run_count,
    paused: job.paused,
    last_run_at: job.last_run_at > 0 ? new Date(job.last_run_at * 1000) : null,
    last_output_ref: job.last_output_ref,
  });
}

async function finalizeJob(job: CronJob, success: boolean): Promise<void> {
  if (isCronModuleInitialized()) {
    const handles = getCronHandleManager();

    if (job.repeat != null && job.run_count >= job.repeat) {
      job.paused = true;
      handles.pause(job.id);
    } else if (!success) {
      handles.scheduleRetry(job.id);
    } else if (!job.paused) {
      handles.register(job);
    }
  }

  await persistJob(job);
}

async function getJobSync(id: string): Promise<CronJob | null> {
  if (!isCronModuleInitialized()) return null;
  const row = await getCronJob(id);
  return row ? CronJobClass.fromRow(row) : null;
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
 * Run job on next event loop tick. runJob uses spawnSync for no_agent scripts; calling void runJob() directly
 * blocks caller before first await (HTTP /run would hang until timeout_sec).
 */
export function enqueueRunJob(job: CronJob): Promise<void> {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      void runJob(job).then(resolve, reject);
    });
  });
}

export async function runJobById(jobId: string): Promise<void> {
  if (!isCronModuleInitialized()) return;
  let row;
  try {
    row = await getCronJob(jobId);
  } catch (e) {
    getCronHandleManager().scheduleRetry(jobId);
    throw e;
  }
  if (!row) return;
  const job = CronJobClass.fromRow(row);
  if (job.paused) return;
  if (job.repeat != null && job.run_count >= job.repeat) return;
  await runJob(job);
}

export async function runJob(job: CronJob): Promise<void> {
  try {
    await runJobInternal(job);
  } catch (e) {
    const errText = String(e);
    const output = `ERROR: ${errText}`;
    job.last_output_ref = saveOutput(job, output);
    await appendCronRunLog({
      job_id: job.id,
      run_count: job.run_count,
      ok: false,
      outputText: output,
      error: errText,
    });
    await notifyDeliver(job, false, output, errText);
    await finalizeJob(job, false);
  }
}

async function runJobInternal(job: CronJob): Promise<void> {
  job.run_count += 1;
  job.last_run_at = Date.now() / 1000;
  await persistJob(job);

  let outputText = "";

  if (job.no_agent) {
    const builtinOutput = job.builtin ? await runCronBuiltinHandler(job.id) : null;
    if (builtinOutput != null) {
      outputText = builtinOutput.slice(0, 10_000);
    } else if (job.script) {
      outputText = runScript(job.script, job.timeout_sec);
    } else {
      throw new Error("no_agent=True requires a script or registered builtin handler");
    }
  } else {
    let context = "";
    if (job.script) context = runScript(job.script, job.timeout_sec);

    const chain: string[] = [];
    for (const upstreamId of job.context_from) {
      const upstream = await getJobSync(upstreamId);
      if (upstream?.last_output_ref) {
        const upstreamOutput = readOutputRef(upstream.last_output_ref);
        if (upstreamOutput) {
          chain.push(`--- Output from job ${upstream.name || upstreamId} ---\n${upstreamOutput}`);
        }
      }
    }

    let fullPrompt = job.prompt;
    const combined = [...chain, context].filter(Boolean).join("\n\n");
    if (combined) fullPrompt = `${combined}\n\n---\n\n${job.prompt}`;

    outputText = (await runCronEngineTurn(job, fullPrompt)).slice(0, 10_000);
  }

  job.last_output_ref = saveOutput(job, outputText);
  await appendCronRunLog({
    job_id: job.id,
    run_count: job.run_count,
    ok: true,
    outputText,
  });
  await notifyDeliver(job, true, outputText);
  await finalizeJob(job, true);
}

/** Read output ref absolute path (for deliver etc.) */
export function resolveJobOutputPath(job: CronJob): string {
  return job.last_output_ref ? fromOutputRef(job.last_output_ref) : "";
}
