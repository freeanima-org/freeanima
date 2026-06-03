#!/usr/bin/env bun
/**
 * 全仓类型检查（唯一入口）：backend tsgo + WebUI tsgo，并行。
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEBUI = join(ROOT, "apps/webui");

type Job = { label: string; cwd: string; args: string[] };

function runJob(job: Job): Promise<{ label: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(job.args[0], job.args.slice(1), {
      cwd: job.cwd,
      stdio: "inherit",
    });
    child.on("error", () => resolve({ label: job.label, code: 1 }));
    child.on("close", (code) => resolve({ label: job.label, code: code ?? 1 }));
  });
}

const jobs: Job[] = [
  {
    label: "backend (tsgo)",
    cwd: ROOT,
    args: ["bunx", "tsgo", "-p", "tsconfig.backend.json", "--noEmit"],
  },
  {
    label: "webui (tsgo)",
    cwd: WEBUI,
    args: ["bunx", "tsgo", "-p", "tsconfig.json", "--noEmit"],
  },
];

const results = await Promise.all(jobs.map(runJob));
const failed = results.filter((r) => r.code !== 0);

if (failed.length > 0) {
  for (const { label, code } of failed) {
    console.error(`typecheck failed: ${label} (exit ${code})`);
  }
  process.exit(1);
}

console.log("typecheck ok");
