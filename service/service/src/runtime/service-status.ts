import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  getDefaultProviderBaseUrl,
  getProfileHopModel,
  loadConfig,
  sanitizeConfigForApi,
  CST_OFFSET_MS,
  PATHS,
} from "@freeanima/service-config";
import { listTools } from "@freeanima/engine-tool";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import {
  ensureBuiltinCronJobs,
  getJob,
  listJobs,
  pauseJob,
  resumeJob,
  enqueueRunJob,
} from "@freeanima/connectors-cron";
import type { CronJobData } from "@freeanima/connectors-cron";
import { listCommandDefs, listCommandDefsForPlatform } from "@freeanima/connectors-commands";
import { getServiceContext } from "../context.ts";

function conv() {
  return getServiceContext().conversation;
}
import type {
  HealthSnapshot,
  PlatformStatusSnapshot,
  SafeConfigSnapshot,
  ServiceSnapshot,
} from "@freeanima/service/schemas/snapshot";
import { countL2FtsRows } from "@freeanima/life-memory/l2-indexer";
import { getStore } from "@freeanima/life-memory/store";
import { PARLOR_PLATFORM } from "./platforms.ts";
import { ANIMA_VERSION } from "./version.ts";

export function startTimeIso(epochSec: number): string {
  if (epochSec <= 0) return "";
  return new Date(epochSec * 1000 + CST_OFFSET_MS)
    .toISOString()
    .replace("Z", "+08:00")
    .slice(0, 19);
}

export function buildMemoryFileStats(): { files_count: number; files_bytes: number } {
  let files_count = 0;
  let files_bytes = 0;
  const add = (path: string) => {
    if (!existsSync(path)) return;
    try {
      files_count++;
      files_bytes += statSync(path).size;
    } catch {
      /* ignore */
    }
  };

  add(PATHS.soul);
  add(join(PATHS.home, "MEMORY.md"));
  add(join(PATHS.home, "USER.md"));

  try {
    if (existsSync(PATHS.memory)) {
      for (const name of readdirSync(PATHS.memory)) {
        if (!name.startsWith("f-") || !name.endsWith(".md")) continue;
        add(join(PATHS.memory, name));
      }
    }
  } catch {
    /* empty */
  }

  return { files_count, files_bytes };
}

export async function buildSessionsByPlatform(): Promise<Record<string, number>> {
  try {
    return await conv().countSessionsByPlatform();
  } catch {
    return {};
  }
}

export function health(): HealthSnapshot {
  return { status: "ok", version: ANIMA_VERSION };
}

export async function buildStatus(
  startTime: number,
  platformStatus: Record<string, PlatformStatusSnapshot>,
  cronJobCount: number,
  host: string,
  port: number,
): Promise<ServiceSnapshot> {
  const cfg = loadConfig();
  const uptime = startTime > 0 ? Math.round(Date.now() / 1000 - startTime) : null;

  const byPlatform = await buildSessionsByPlatform();
  const sessionCount = Object.values(byPlatform).reduce((a, b) => a + b, 0);

  let toolCount = 0;
  try {
    toolCount = listTools().length;
  } catch {
    toolCount = 0;
  }

  let memoryKb = 0;
  try {
    const statusText = readFileSync(`/proc/${process.pid}/status`, "utf-8");
    for (const line of statusText.split("\n")) {
      if (line.startsWith("VmRSS:")) {
        memoryKb = parseInt(line.split(/\s+/)[1] ?? "0", 10);
        break;
      }
    }
  } catch {
    /* non-Linux */
  }

  const fileStats = buildMemoryFileStats();
  let factsCount = 0;
  let l2IndexRows = 0;
  try {
    factsCount = getStore().count();
  } catch {
    factsCount = 0;
  }
  try {
    l2IndexRows = countL2FtsRows();
  } catch {
    l2IndexRows = 0;
  }

  const status: ServiceSnapshot = {
    status: "running",
    pid: process.pid,
    version: ANIMA_VERSION,
    uptime_seconds: uptime,
    start_time_iso: startTimeIso(startTime),
    config: {
      model: getProfileHopModel(cfg, PROFILE_CHAT),
      api_base: getDefaultProviderBaseUrl(cfg),
    },
    sessions: { total: sessionCount, by_platform: byPlatform },
    tools: toolCount,
    cron_jobs: cronJobCount,
    platforms: { ...platformStatus },
    memory_kb: memoryKb,
    memory: {
      files_count: fileStats.files_count,
      files_bytes: fileStats.files_bytes,
      facts_count: factsCount,
      l2_index_rows: l2IndexRows,
    },
  };
  if (host) status.host = host;
  if (port) status.port = port;
  return status;
}

export function getConfig(): SafeConfigSnapshot {
  const cfg = loadConfig();
  return { config: sanitizeConfigForApi(cfg) as SafeConfigSnapshot["config"] };
}

export function listToolsApi(): { tools: { name: string; description: string }[] } {
  return { tools: listTools().map((t) => ({ name: t.name, description: t.description })) };
}

export function listCronJobs(): { jobs: CronJobData[] } {
  return { jobs: listJobs().map((j) => j.toJSON()) };
}

export function pauseCronJob(jobId: string): CronJobData | null {
  if (!pauseJob(jobId)) return null;
  return getJob(jobId)?.toJSON() ?? null;
}

export function resumeCronJob(jobId: string): CronJobData | null {
  if (!resumeJob(jobId)) return null;
  return getJob(jobId)?.toJSON() ?? null;
}

export function runCronJobNow(jobId: string): { job: CronJobData; message: string } | null {
  const job = getJob(jobId);
  if (!job) return null;
  enqueueRunJob(job);
  return {
    job: job.toJSON(),
    message: `已触发立即运行: ${job.name}`,
  };
}

export function ensureBuiltinCronJobsRegistered(): void {
  ensureBuiltinCronJobs();
}

export function listCommands(opts?: { platform?: string; all?: boolean }): {
  commands: {
    name: string;
    description: string;
    scope: string;
    platforms: string[] | null;
  }[];
  platform?: string;
} {
  const platform = opts?.platform ?? PARLOR_PLATFORM;
  const defs = opts?.all ? listCommandDefs() : listCommandDefsForPlatform(platform);
  return {
    commands: defs.map((c) => ({
      name: c.name,
      description: c.description,
      scope: c.scope ?? "session",
      platforms: c.platforms?.length ? [...c.platforms] : null,
    })),
    ...(opts?.all ? {} : { platform }),
  };
}
