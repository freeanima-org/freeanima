import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { PATHS, CST_OFFSET_MS } from "@freeanima/legacy-kernel";
import { CronJob } from "./models.js";
import { cronJobsFileSchema } from "@freeanima/legacy-kernel";

export const JOBS_FILE = () => join(PATHS.cronDir, "jobs.json");
export const SCRIPTS_DIR = () => join(PATHS.cronDir, "scripts");
export const OUTPUT_DIR = () => join(PATHS.cronDir, "output");

function nowIso(): string {
  return new Date(Date.now() + CST_OFFSET_MS).toISOString().replace("Z", "+08:00");
}

export function ensureDirs(): void {
  mkdirSync(PATHS.cronDir, { recursive: true });
  mkdirSync(SCRIPTS_DIR(), { recursive: true });
  mkdirSync(OUTPUT_DIR(), { recursive: true });
}

export function loadAll(): CronJob[] {
  const file = JOBS_FILE();
  if (!existsSync(file)) return [];
  try {
    const raw: unknown = JSON.parse(readFileSync(file, "utf-8"));
    const parsed = cronJobsFileSchema.safeParse(raw);
    if (!parsed.success) return [];
    const jobs: CronJob[] = [];
    for (const item of parsed.data) {
      try {
        jobs.push(new CronJob(item));
      } catch {
        /* skip invalid job */
      }
    }
    return jobs;
  } catch {
    return [];
  }
}

export function saveAll(jobs: CronJob[]): void {
  ensureDirs();
  writeFileSync(JOBS_FILE(), JSON.stringify(jobs.map((j) => j.toJSON()), null, 2), "utf-8");
}

export function find(jobId: string): CronJob | null {
  return loadAll().find((j) => j.id === jobId) ?? null;
}

export function add(job: CronJob): void {
  const jobs = loadAll();
  if (jobs.some((j) => j.id === job.id)) {
    throw new Error(`Job with ID '${job.id}' already exists`);
  }
  jobs.push(job);
  saveAll(jobs);
}

export function update(job: CronJob): boolean {
  const jobs = loadAll();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx < 0) return false;
  job.updated_at = nowIso();
  jobs[idx] = job;
  saveAll(jobs);
  return true;
}

export function remove(jobId: string): boolean {
  const jobs = loadAll();
  const next = jobs.filter((j) => j.id !== jobId);
  if (next.length === jobs.length) return false;
  saveAll(next);
  return true;
}

export function resolveScriptPath(script: string): string {
  if (isAbsolute(script)) return script;
  return join(SCRIPTS_DIR(), script);
}

export function outputPath(jobId: string, runNumber: number): string {
  ensureDirs();
  return join(OUTPUT_DIR(), `${jobId}-${String(runNumber).padStart(4, "0")}.txt`);
}
