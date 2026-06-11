import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getTokenizerBindingSnapshot } from "@freeanima/engine-tokenizer";
import {
  getDefaultProviderBaseUrl,
  getProfileHopModel,
  isEmbeddingEnabled,
  loadConfig,
  sanitizeConfigForApi,
  PATHS,
} from "@freeanima/service-config";
import { formatCstIsoFromEpoch } from "@freeanima/engine-util";
import { getServiceContext } from "../context.ts";
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
import { buildToolsStatus } from "@freeanima/engine-tool";
import { listCommandDefs, listCommandDefsForPlatform } from "@freeanima/connectors-commands";
import { pingDatabase } from "@freeanima/connectors-db-pg";
import { pingRedis } from "@freeanima/connectors-redis";

function conv() {
  return getServiceContext().conversation;
}
import type {
  DependencyStatus,
  HealthSnapshot,
  PlatformStatusSnapshot,
  SafeConfigSnapshot,
  ServiceSnapshot,
} from "@freeanima/service/schemas/snapshot";
import { PARLOR_PLATFORM } from "./platforms.ts";
import { ANIMA_VERSION } from "./version.ts";

export function startTimeIso(epochSec: number): string {
  return formatCstIsoFromEpoch(epochSec);
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

  add(join(PATHS.home, "MEMORY.md"));
  add(join(PATHS.home, "USER.md"));

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

export async function buildDependenciesStatus(): Promise<{
  postgres: DependencyStatus;
  redis: DependencyStatus;
}> {
  const [postgres, redis] = await Promise.all([pingDatabase(), pingRedis()]);
  return { postgres, redis };
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
    toolCount = getServiceContext().engine.catalog.toolSets.listTools().length;
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
  const dependencies = await buildDependenciesStatus();
  let factsCount = 0;
  let l2IndexRows = 0;
  try {
    factsCount = await getServiceContext().engine.repos.semanticMemory.count();
  } catch {
    factsCount = 0;
  }
  try {
    l2IndexRows = await conv().repos.session.countSearchableMessages();
  } catch {
    l2IndexRows = 0;
  }

  const chatModel = getProfileHopModel(cfg, PROFILE_CHAT);
  const tokenizerStatus: ServiceSnapshot["tokenizer"] = {};
  const chatBinding = getTokenizerBindingSnapshot(chatModel);
  if (chatBinding) tokenizerStatus.chat = chatBinding;

  if (isEmbeddingEnabled()) {
    const embeddingModel = cfg.embedding?.model?.trim();
    if (embeddingModel) {
      const embeddingBinding = getTokenizerBindingSnapshot(embeddingModel);
      if (embeddingBinding) tokenizerStatus.embedding = embeddingBinding;
    }
  }

  const status: ServiceSnapshot = {
    status: "running",
    pid: process.pid,
    version: ANIMA_VERSION,
    uptime_seconds: uptime,
    start_time_iso: startTimeIso(startTime),
    config: {
      model: chatModel,
      api_base: getDefaultProviderBaseUrl(cfg),
    },
    tokenizer: tokenizerStatus.chat || tokenizerStatus.embedding ? tokenizerStatus : undefined,
    sessions: { total: sessionCount, by_platform: byPlatform },
    tools: toolCount,
    cron_jobs: cronJobCount,
    platforms: { ...platformStatus },
    memory_kb: memoryKb,
    memory: {
      files_count: fileStats.files_count,
      files_bytes: fileStats.files_bytes,
      semantic_memory_count: factsCount,
      dialogue_message_count: l2IndexRows,
    },
    dependencies,
  };
  if (host) status.host = host;
  if (port) status.port = port;
  return status;
}

export function getConfig(): SafeConfigSnapshot {
  const cfg = loadConfig();
  return { config: sanitizeConfigForApi(cfg) as SafeConfigSnapshot["config"] };
}

export function listToolsApi() {
  const { engine } = getServiceContext();
  return buildToolsStatus(engine.catalog.toolSets);
}

export async function listCronJobs(): Promise<{ jobs: CronJobData[] }> {
  const jobs = await listJobs();
  return { jobs: jobs.map((j) => j.toJSON()) };
}

export async function pauseCronJob(jobId: string): Promise<CronJobData | null> {
  if (!(await pauseJob(jobId))) return null;
  const job = await getJob(jobId);
  return job?.toJSON() ?? null;
}

export async function resumeCronJob(jobId: string): Promise<CronJobData | null> {
  if (!(await resumeJob(jobId))) return null;
  const job = await getJob(jobId);
  return job?.toJSON() ?? null;
}

export async function runCronJobNow(
  jobId: string,
): Promise<{ job: CronJobData; message: string } | null> {
  const job = await getJob(jobId);
  if (!job) return null;
  void enqueueRunJob(job);
  return {
    job: job.toJSON(),
    message: `Triggered immediate run: ${job.name}`,
  };
}

export async function ensureBuiltinCronJobsRegistered(): Promise<void> {
  await ensureBuiltinCronJobs();
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
