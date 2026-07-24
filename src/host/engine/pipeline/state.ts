import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/host/core/config";
import { safeParseOrNull } from "@freeanima/host/core/util";
import { z } from "zod";

import type { PipelineRunState } from "./types.ts";

const stepStateSchema = z.object({
  status: z.enum(["pending", "running", "completed", "skipped", "failed"]),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  skipped_reason: z.string().optional(),
});

const runStateSchema = z.object({
  pipeline_id: z.string(),
  run_id: z.string(),
  day: z.string().optional(),
  started_at: z.string(),
  finished_at: z.string().optional(),
  status: z.enum(["running", "completed", "failed"]),
  steps: z.record(z.string(), stepStateSchema),
});

function stateDir(): string {
  return join(PATHS.home, "runtime");
}

function statePath(pipelineId: string): string {
  return join(stateDir(), `pipeline_${pipelineId}_run.json`);
}

export function readPipelineRunState(pipelineId: string): PipelineRunState | null {
  const p = statePath(pipelineId);
  if (!existsSync(p)) return null;
  try {
    const raw: unknown = JSON.parse(readFileSync(p, "utf-8"));
    return safeParseOrNull(runStateSchema, raw) as PipelineRunState | null;
  } catch {
    return null;
  }
}

export function writePipelineRunState(state: PipelineRunState): void {
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(statePath(state.pipeline_id), JSON.stringify(state, null, 2), "utf-8");
}

export function resetPipelineRunStateForTests(pipelineId?: string): void {
  if (pipelineId) {
    const p = statePath(pipelineId);
    if (existsSync(p)) writeFileSync(p, "{}", "utf-8");
    return;
  }
  // 测试隔离：不扫描目录，由单测指定 pipeline id
}
